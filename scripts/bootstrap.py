#!/usr/bin/env python3
"""Generate development-only secrets and Asterisk configuration, only inside repo."""
import os, secrets, pathlib, subprocess, re
root=pathlib.Path(__file__).resolve().parents[1]
os.chdir(root)
local=root/'.local'; local.mkdir(exist_ok=True); local.chmod(0o700)
env=root/'.env'
if not env.exists():
    values={k:secrets.token_hex(24) for k in ['POSTGRES_PASSWORD','AMI_PASSWORD','TOKEN_201','TOKEN_202','TOKEN_OTHER','SIP_201_PASSWORD','SIP_202_PASSWORD']}
    values['MEDIA_ADDRESS']='127.0.0.1'
    env.write_text(''.join(f'{k}={v}\n' for k,v in values.items())); env.chmod(0o600)
new_keys=['POSTGRES_APP_PASSWORD','QUEUE_AMI_PASSWORD','TOKEN_203','SIP_203_PASSWORD','AMI_B_PASSWORD','QUEUE_AMI_B_PASSWORD']+[f'{prefix}_{n}{suffix}' for n in (211,212,213) for prefix,suffix in [('TOKEN',''),('SIP','_PASSWORD')]]
for key in new_keys:
    if not any(line.startswith(key+'=') for line in env.read_text().splitlines()):
        with env.open('a') as out:
            out.write('\n'+key+'='+secrets.token_hex(24)+'\n')
values=dict(line.split('=',1) for line in env.read_text().splitlines() if line and not line.startswith('#'))
env.chmod(0o600)
for key in ['POSTGRES_PASSWORD','AMI_PASSWORD','QUEUE_AMI_PASSWORD','TOKEN_203','SIP_203_PASSWORD','TOKEN_201','TOKEN_202','TOKEN_OTHER','SIP_201_PASSWORD','SIP_202_PASSWORD']+new_keys:
    if not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', values.get(key,'')):
        raise SystemExit(f'Invalid or missing {key}; preserve your existing .env and generate strong development credentials.')
if values['POSTGRES_PASSWORD']==values['POSTGRES_APP_PASSWORD']:
    raise SystemExit('PostgreSQL admin and app credentials must be distinct.')
ca_root=pathlib.Path(subprocess.check_output(['mkcert','-CAROOT'],text=True).strip())
if not (ca_root/'rootCA.pem').is_file() or not (ca_root/'rootCA-key.pem').is_file():
    raise SystemExit('Prepare a trusted development CA first; see docs/SETUP.md. Bootstrap will not create a global CA.')
certs=local/'certs'; certs.mkdir(exist_ok=True)
if not (certs/'localhost.pem').exists():
    subprocess.run(['mkcert','-cert-file',str(certs/'localhost.pem'),'-key-file',str(certs/'localhost-key.pem'),'localhost','127.0.0.1','::1'],check=True)
# The Asterisk user reads the mounted leaf key; .local is private (0700) on the host.
(certs/'localhost-key.pem').chmod(0o644)
print('Development secrets and TLS certificate ready. No system trust settings changed.')
