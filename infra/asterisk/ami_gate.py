"""Internal AMI action gate. Native AMI remains on this container's loopback."""
import asyncio
import os
import re

TENANT = os.environ.get("PBX_TENANT", "")
EXTENSIONS = {os.environ.get(k, "") for k in ("EXT_A", "EXT_B", "EXT_C")}
LIMIT = asyncio.Semaphore(12)
ACTION_ID = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")
SECRET = re.compile(r"[A-Za-z0-9_-]{32,128}\Z")
ROLES = {
    "observer": {"pjsipshowcontacts", "coreshowchannels"},
    "queue-controller": {
        "pjsipshowcontacts", "coreshowchannels", "queuestatus",
        "queueadd", "queueremove", "queuepause",
    },
}


def check(frame, role):
    """Return validated frame role, or raise ValueError. Never log input."""
    fields = {}
    for line in frame[:-4].decode("ascii").split("\r\n"):
        key, sep, value = line.partition(":")
        key = key.lower()
        if not sep or not key.isalpha() or key in fields or any(ord(c) < 32 for c in value):
            raise ValueError
        fields[key] = value.strip()
    action = fields.pop("action", "").lower()
    action_id = fields.pop("actionid", "")
    if action_id and not ACTION_ID.fullmatch(action_id):
        raise ValueError
    if role is None:
        user = fields.get("username")
        if (
            action != "login" or set(fields) != {"username", "secret", "events"}
            or user not in ROLES or not SECRET.fullmatch(fields["secret"])
            or fields["events"] != ("on" if user == "observer" else "off")
        ):
            raise ValueError
        return user
    if action not in ROLES[role]:
        raise ValueError
    if action.startswith("queue") and action != "queuestatus":
        keys = {"queue", "interface"} | ({"paused"} if action in {"queueadd", "queuepause"} else set())
        if set(fields) != keys:
            raise ValueError
        name = fields["queue"]
        if not re.fullmatch("t" + re.escape(TENANT) + r"-3[0-9]{2}", name):
            raise ValueError
        interface = fields["interface"]
        if not interface.startswith("PJSIP/") or interface.removeprefix("PJSIP/") not in EXTENSIONS:
            raise ValueError
        if "paused" in fields and fields["paused"] not in {"true", "false"}:
            raise ValueError
    elif fields:
        raise ValueError
    return role


async def handle(client, outbound):
    if LIMIT.locked():
        outbound.close()
        return
    async with LIMIT:
        peer = None
        tasks = []
        try:
            incoming, peer = await asyncio.wait_for(asyncio.open_connection("127.0.0.1", 5039), 3)

            async def requests():
                role = None
                while True:
                    frame = await asyncio.wait_for(client.readuntil(b"\r\n\r\n"), 20)
                    try:
                        role = check(frame, role)
                    except ValueError:
                        outbound.write(b"Response: Error\r\nMessage: Action denied by Flora AMI gate\r\n\r\n")
                        await outbound.drain()
                        return
                    peer.write(frame)
                    await peer.drain()

            async def responses():
                while data := await incoming.read(65536):
                    outbound.write(data)
                    await asyncio.wait_for(outbound.drain(), 5)

            tasks = [asyncio.create_task(requests()), asyncio.create_task(responses())]
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        except (OSError, asyncio.TimeoutError):
            pass
        finally:
            for task in tasks:
                task.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            if peer is not None:
                peer.close()
            outbound.close()


async def main():
    server = await asyncio.start_server(handle, "0.0.0.0", 5038, limit=4096)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
