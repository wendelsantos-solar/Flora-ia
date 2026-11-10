#!/usr/bin/env python3
"""Generate the isolated SIP simulator project. The existing stack is never targeted."""
import json
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".local/phase-03a"
PROJECT = "flora-03a"
os.umask(0o077)


def put(path, value, mode=0o600):
    path.write_text(value)
    path.chmod(mode)


def endpoint(name, context, from_user, auth="", outgoing="", contact=""):
    return f"""
[{name}]
type=endpoint
context={context}
transport=lab-udp
from_user={from_user}
disallow=all
allow=ulaw
direct_media=no
allow_transfer=no
identify_by=username
set_var=TRANSFER_CONTEXT=internal-only
{f'auth={auth}' if auth else ''}
{f'outbound_auth={outgoing}' if outgoing else ''}
{f'aors={name}' if contact else ''}
""" + (f"""
[{name}]
type=aor
contact=sip:{contact}
""" if contact else "")


def auth(name, username, password):
    return f"\n[{name}]\ntype=auth\nauth_type=userpass\nusername={username}\npassword={password}\n"


def setup():
    if WORK.exists():
        raise SystemExit("Lab already generated. Use its Compose file.")
    for command in (["ps","-aq"],["volume","ls","-q"]):
        existing=subprocess.check_output(["docker",*command,"--filter",f"label=com.docker.compose.project={PROJECT}"])
        if existing.strip():
            raise SystemExit("Refusing to reuse existing lab containers or volumes.")
    WORK.mkdir(parents=True)
    keys = ["POSTGRES_PASSWORD","POSTGRES_APP_PASSWORD","AMI_PASSWORD","AMI_B_PASSWORD",
            "QUEUE_AMI_PASSWORD","QUEUE_AMI_B_PASSWORD","TOKEN_OTHER","SIP_LAB_KEY_A","SIP_LAB_KEY_B"]
    keys += [f"{key}{n}{suffix}" for n in (201,202,203,211,212,213)
             for key,suffix in (("TOKEN_",""),("SIP_","_PASSWORD"))]
    env = {key: secrets.token_hex(24) for key in keys}
    put(WORK/"env", "".join(f"{k}={v}\n" for k,v in env.items()))
    config = json.loads(subprocess.check_output(["docker","compose","--env-file",str(WORK/"env"),"config","--format","json"],
        cwd=ROOT, env={k:v for k,v in os.environ.items() if k not in env}))
    config["name"] = PROJECT
    services = config["services"]
    services["web"]["image"] = "flora-03a-web"
    for service in services.values():
        service.pop("ports",None)
        service.pop("restart",None)
    config["volumes"] = {key:{"name":f"{PROJECT}_{key}"} for key in config["volumes"]}
    config["networks"] = {key:{"internal":True} for key in config["networks"]}
    services["backend"]["image"] = "flora-03a-backend"
    services["backend"]["environment"].update({k:env[k] for k in ("SIP_LAB_KEY_A","SIP_LAB_KEY_B")})
    for side, suffix, line in (("a","",201),("b","-b",211)):
        simulator=f"carrier-{side}"
        pbx=f"asterisk{suffix}"
        working=WORK/side
        templates=working/"templates"
        carrier=working/"carrier"
        templates.mkdir(parents=True)
        carrier.mkdir()
        for directory in (working,templates,carrier):
            directory.chmod(0o755)
        for item in (ROOT/"infra/asterisk/templates").iterdir():
            if item.is_file(): put(templates/item.name,item.read_text(),0o644)
        transport="\n[lab-udp]\ntype=transport\nprotocol=udp\nbind=0.0.0.0:5060\n"
        passwords={key:secrets.token_hex(24) for key in ("provider","pbx","line","blocked")}
        lab=transport
        lab+=endpoint("simulator","flora-sip-lab-in","flora",auth="from-provider",outgoing="to-provider",contact=f"{simulator}:5060")
        lab+=auth("from-provider","simulator",passwords["provider"])+auth("to-provider","flora",passwords["pbx"])
        for name,user,assigned in (("lab-line","line",line),("lab-blocked","blocked",line+1)):
            lab+=endpoint(name,"flora-sip-lab-out",name,auth=f"auth-{user}")+f"set_var=FLORA_LINE={assigned}\n"
            lab+=auth(f"auth-{user}",name,passwords[user])
        # Route the existing internal extension to a static UDP test fixture on this disposable PBX.
        # Existing production-style WebRTC registrations and templates are untouched.
        lab+=f"\n[{line}](+type=endpoint)\ntransport=lab-udp\nfrom_user=flora\noutbound_auth=to-provider\nwebrtc=no\nmedia_encryption=no\nuse_avpf=no\nice_support=no\nrtcp_mux=no\n"
        lab+=f"\n[{line}](+type=aor)\ncontact=sip:{line}@{simulator}:5060\n"
        put(templates/"pjsip.conf",(templates/"pjsip.conf").read_text()+lab)
        lab_routes=(ROOT/"infra/sip-lab/extensions.conf").read_text()
        patterns="".join(f"exten => _{prefix}{'X'*length},1,Goto(flora-sip-lab-dial,${{EXTEN}},1)\n"
                         for prefix in ("", "+") for length in range(3,16))
        lab_routes=lab_routes.replace("; Patterns are generated from fixed digit lengths in the lab provisioning script.",patterns)
        put(templates/"extensions.conf",(templates/"extensions.conf").read_text()+lab_routes,0o644)
        added="load=res_pjsip_outbound_authenticator_digest.so\nload=res_speech.so\nload=res_agi.so\nload=func_timeout.so\nload=app_stack.so\n"
        put(templates/"modules.conf",(templates/"modules.conf").read_text()+added,0o644)
        instance=services[pbx]
        instance.pop("build")
        instance["image"]=f"flora-phase1-{pbx}:latest"
        instance["environment"]["SIP_LAB_KEY"]=env[f"SIP_LAB_KEY_{side.upper()}"]
        for mount in instance["volumes"]:
            if mount["target"]=="/templates": mount["source"]=str(templates)
        instance["volumes"].append(f"{ROOT/'infra/sip-lab/gate.py'}:/opt/flora/gate.py:ro")
        instance["volumes"].append(f"{ROOT/'infra/sip-lab/entrypoint.sh'}:/opt/flora/entrypoint.sh:ro")
        instance["entrypoint"] = ["/bin/sh", "/opt/flora/entrypoint.sh"]
        provider="[global]\ntype=global\nendpoint_identifier_order=username\n"+transport
        provider+=endpoint("flora","carrier-answer","simulator",auth="from-flora",outgoing="to-flora",contact=f"{pbx}:5060")
        provider+=auth("from-flora","flora",passwords["pbx"])+auth("to-flora","simulator",passwords["provider"])
        provider+=endpoint("internal-test","carrier-answer",str(line),outgoing="to-internal",contact=f"{pbx}:5060")
        provider+=auth("to-internal",str(line),env[f"SIP_{line}_PASSWORD"])
        for name,user,from_user in (("line","line","lab-line"),("blocked","blocked","lab-blocked"),("bad","line","lab-line")):
            provider+=endpoint(name,"carrier-answer",from_user,outgoing=f"to-{name}",contact=f"{pbx}:5060")
            provider+=auth(f"to-{name}",from_user,passwords[user] if name!="bad" else secrets.token_hex(24))
        put(carrier/"pjsip.conf",provider,0o644)
        put(carrier/"asterisk.conf",(templates/"asterisk.conf").read_text(),0o644)
        put(carrier/"modules.conf", (templates/"modules.conf").read_text()+"load=res_clioriginate.so\nload=app_transfer.so\nload=func_db.so\n",0o644)
        put(carrier/"extensions.conf",f"""[carrier-answer]
exten => 8800000001,1,Set(DB(flora-lab/default-id)=${{UNIQUEID}})
 same => n,Answer()
 same => n,Wait(30)
 same => n,Hangup()
exten => 8800000002,1,Busy(1)
exten => 8800000003,1,Wait(15)
 same => n,Hangup()
exten => 8800000004,1,Transfer(PJSIP/sip:8800000001@{pbx})
 same => n,Hangup()
exten => 8800000005,1,Answer()
 same => n,Wait(1)
 same => n,Transfer(PJSIP/sip:8800000001@{pbx})
 same => n,Set(DB(flora-lab/refer)=${{TRANSFERSTATUS}}/${{TRANSFERSTATUSPROTOCOL}})
 same => n,Hangup()
exten => {line},1,Answer()
 same => n,Wait(30)
 same => n,Hangup()
""",0o644)
        services[simulator]={"image":f"flora-phase1-{pbx}:latest","entrypoint":["/usr/sbin/asterisk","-f"],
            "volumes":[f"{carrier}:/etc/asterisk:ro"],"networks":[f"pbx_{side}"]}
    assert all("ports" not in service and "container_name" not in service for service in services.values())
    put(WORK/"compose.json",json.dumps(config,indent=2))
    print("Isolated SIP lab generated.")


if __name__=="__main__":
    setup()
