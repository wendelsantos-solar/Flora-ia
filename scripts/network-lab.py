#!/usr/bin/env python3
"""Create a disposable WireGuard topology; never operates on the running Flora stack."""
import ipaddress
import json
import os
import pathlib
import secrets
import subprocess
import sys

os.umask(0o077)
root = pathlib.Path(__file__).resolve().parents[1]
work = root / ".local/phase-02-6/lab"
project = "flora-026"
infra = root / "infra/network-lab"


def run(*args, **kwargs):
    return subprocess.check_output(args, cwd=root, text=True, **kwargs).strip()


def private(path, text):
    path.write_text(text)
    path.chmod(0o600)


def setup():
    if work.exists():
        raise SystemExit("Lab directory already exists; use its generated compose file, or stop and archive it first.")
    existing = run("docker", "ps", "-aq", "--filter", f"label=com.docker.compose.project={project}")
    volumes = run("docker", "volume", "ls", "-q", "--filter", f"label=com.docker.compose.project={project}")
    if existing or volumes:
        raise SystemExit("Existing lab containers or volumes detected; refusing to replace them.")
    used = run("docker", "network", "ls", "-q").splitlines()
    for net in json.loads(run("docker", "network", "inspect", *used)):
        for cfg in (net["IPAM"]["Config"] or []):
            if cfg.get("Subnet"):
                found = ipaddress.ip_network(cfg["Subnet"], strict=False)
                if found.version == 4 and any(found.overlaps(ipaddress.ip_network(s)) for s in ("10.252.26.0/24", "10.253.26.0/24")):
                    raise SystemExit("Private lab subnet overlaps an existing Docker network.")
    work.mkdir(parents=True)
    names = (201, 202, 203, 211, 212, 213)
    keys = ["POSTGRES_PASSWORD", "POSTGRES_APP_PASSWORD", "AMI_PASSWORD", "AMI_B_PASSWORD", "QUEUE_AMI_PASSWORD", "QUEUE_AMI_B_PASSWORD", "TOKEN_OTHER"]
    keys += [f"TOKEN_{n}" for n in names] + [f"SIP_{n}_PASSWORD" for n in names]
    private(work / "env", "".join(f"{k}={secrets.token_hex(24)}\n" for k in keys))
    certs = work / "certs"
    certs.mkdir()
    certs.chmod(0o755)
    private(work / "ca.conf", "[req]\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\n[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n")
    private(work / "leaf.ext", "subjectAltName=DNS:lab.flora.test\nextendedKeyUsage=serverAuth\n")
    for cmd in [
        ["req", "-config", str(work / "ca.conf"), "-new", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=Flora network lab only", "-keyout", str(work / "ca.key"), "-out", str(certs / "root.crt")],
        ["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=lab.flora.test", "-keyout", str(certs / "leaf-key.pem"), "-out", str(work / "leaf.csr")],
        ["x509", "-req", "-days", "2", "-in", str(work / "leaf.csr"), "-CA", str(certs / "root.crt"), "-CAkey", str(work / "ca.key"), "-CAcreateserial", "-extfile", str(work / "leaf.ext"), "-out", str(certs / "leaf.pem")],
    ]:
        subprocess.run(["openssl", *cmd], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    (work / "ca.key").unlink()
    # PBX runs as a non-root UID. The host parent directory is mode 0700.
    (certs / "leaf-key.pem").chmod(0o644)
    (certs / "leaf.pem").chmod(0o644)
    (certs / "root.crt").chmod(0o644)
    for a, b in [("leaf.pem", "localhost.pem"), ("leaf-key.pem", "localhost-key.pem")]:
        os.link(certs / a, certs / b)

    def wg(command, key=None):
        return run("docker", "run", "--rm", "-i", "--network", "none", "--entrypoint", "wg", "flora-026-router", command, input=key)

    secret = wg("genkey")
    pub = wg("pubkey", secret + "\n")
    router_conf = f"[Interface]\nPrivateKey = {secret}\nListenPort = 51820\n"
    peers = (8, 9, 10, 24)
    for i in range(4):
        sk = wg("genkey")
        pk = wg("pubkey", sk + "\n")
        base = 64 + 16 * i
        address = f"10.252.26.{peers[i]}"
        router_conf += f"\n[Peer]\nPublicKey = {pk}\nAllowedIPs = {address}/32\n"
        private(work / f"client-{i+1}.conf", f"[Interface]\nPrivateKey = {sk}\n\n[Peer]\nPublicKey = {pub}\nEndpoint = 10.252.26.{base+2}:51820\nAllowedIPs = 10.252.26.0/26\nPersistentKeepalive = 10\n")
    private(work / "router.conf", router_conf)

    compose_env = {k: v for k, v in os.environ.items() if k not in {*keys, "MEDIA_ADDRESS"}}
    config = json.loads(run("docker", "compose", "--env-file", str(work / "env"), "config", "--format", "json", env=compose_env))
    config["name"] = project
    s = config["services"]
    for item in s.values():
        item.pop("ports", None)
        item.pop("restart", None)
    for engine, ip in [("asterisk", "10.252.26.3"), ("asterisk-b", "10.252.26.19")]:
        item = s[engine]
        item.pop("build")
        item["image"] = f"flora-phase1-{engine}:latest"
        item["environment"]["MEDIA_ADDRESS"] = ip
        for volume in item["volumes"]:
            if volume["target"] == "/certs":
                volume["source"] = str(certs)
        item["networks"] = {"pbx_a" if engine == "asterisk" else "pbx_b": {"ipv4_address": ip}}
    s["backend"].pop("build")
    s["backend"]["image"] = "flora-phase1-backend:latest"
    s["backend"]["environment"]["WEB_ORIGIN"] = "https://lab.flora.test"
    s["web"]["build"]["args"] = {"NEXT_PUBLIC_FLORA_WSS_A": "wss://lab.flora.test:8443/ws", "NEXT_PUBLIC_FLORA_WSS_B": "wss://lab.flora.test:8444/ws"}
    config["volumes"] = {k: {"name": f"{project}_{k}"} for k in config["volumes"]}
    config["networks"] = {
        n: {"internal": True, "ipam": {"config": [{"subnet": f"10.252.26.{i*16}/28"}]}}
        for i, n in enumerate(["pbx_a", "pbx_b", "private", "edge"] + [f"client_{i}" for i in range(1, 5)])
    }
    for name, clients in [("pbx_a", peers[:3]), ("pbx_b", peers[3:])]:
        config["networks"][name]["ipam"]["config"][0]["aux_addresses"] = {
            f"wireguard_{i}": f"10.252.26.{n}" for i, n in enumerate(clients, 1)
        }
    s["edge"] = {
        "image": "nginx:alpine", "depends_on": ["web", "asterisk", "asterisk-b"],
        "volumes": [f"{infra / 'nginx.conf'}:/etc/nginx/nginx.conf:ro", f"{certs}:/run/flora:ro"],
        "networks": {"private": {}, "pbx_a": {}, "pbx_b": {}, "edge": {"ipv4_address": "10.252.26.51"}},
    }
    s["router"] = {
        "image": "flora-026-router", "cap_add": ["NET_ADMIN"],
        "sysctls": {"net.ipv4.ip_forward": "1"},
        "volumes": [f"{work / 'router.conf'}:/run/flora/wg.conf:ro"],
        "networks": {n: {"ipv4_address": f"10.252.26.{i*16+2}"} for i, n in enumerate(config["networks"]) if n != "private"},
    }
    for i in range(1, 5):
        s[f"client{i}"] = {
            "image": "flora-026-browser", "init": True, "cap_add": ["NET_ADMIN"], "shm_size": "256m",
            "environment": {"FLORA_WG_IP": f"10.252.26.{peers[i-1]}", "NODE_EXTRA_CA_CERTS": "/run/flora/root.crt"},
            "volumes": [f"{work / f'client-{i}.conf'}:/run/flora/wg.conf:ro", f"{certs / 'root.crt'}:/run/flora/root.crt:ro"],
            "extra_hosts": ["lab.flora.test:10.252.26.51"], "depends_on": ["router", "edge"],
            "networks": {f"client_{i}": {"ipv4_address": f"10.252.26.{64+16*(i-1)+3}"}},
        }
    s["control"] = {
        "image": "flora-026-browser", "init": True, "environment": {"FLORA_CONTROL": "1"},
        "volumes": [f"{work / 'env'}:/run/flora/env:ro", f"{root / 'docs/evidence/phase-02-6'}:/evidence"],
        "networks": {f"client_{i}": {"ipv4_address": f"10.252.26.{64+16*(i-1)+4}"} for i in range(1, 5)},
    }
    assert all("ports" not in item and "container_name" not in item for item in s.values())
    private(work / "compose.json", json.dumps(config, indent=2))
    print("Lab generated. No running stack modified; Compose config remains private.")


if __name__ == "__main__":
    if sys.argv[1:] != ["setup"]:
        raise SystemExit("Usage: scripts/network-lab.py setup")
    setup()
