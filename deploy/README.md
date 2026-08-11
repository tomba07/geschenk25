# Geschenk on the shared VM

Geschenk runs beside Chessquestia on the same DigitalOcean VM. The existing Caddy container handles HTTPS for `geschenk.mteschke.com` and routes:

- `/api/*` to `geschenk-api:3000`
- everything else to `geschenk-web:80`

## DNS

In Cloudflare, change `geschenk.mteschke.com` to point at the VM:

```txt
Type: A
Name: geschenk
IPv4: 165.227.2.163
Proxy: DNS only
TTL: Auto
```

Remove the old Vercel CNAME for this hostname.

## First Deploy

```sh
./deploy/update-vm.sh
```

The first run creates `/opt/apps/geschenk25/deploy/.env` on the VM and stops so you can fill secrets.

Required values:

```txt
POSTGRES_PASSWORD=...
JWT_SECRET=...
```

Google login requires an OAuth web client with:

```txt
Authorized JavaScript origin: https://geschenk.mteschke.com
Authorized redirect URI: https://geschenk.mteschke.com/api/auth/google/callback
```

Then set:

```txt
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Run the deploy script again after editing `.env`.
