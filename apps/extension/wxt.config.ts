import { defineConfig } from 'wxt';

import { resolveApiOrigin, toHostPermission } from './lib/api-origin';

/**
 * Public half of the extension signing key (ADR 12). Pins the extension ID to
 * `pcnamdhfehfcfcjlpgahbgkmhedblele` for dev, unpacked and store builds.
 * The private key (`qatch-extension.pem`) is never committed.
 */
const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsVo1yc42RJS9RHV20EmQ6uoiJsiJmQAeXjCv+m1wDRvkMfL8JI+f+4vjRKC+UycY+JXjg0fcAY6z+dg2wKCnu8uk6KhGKuKCRaSEPE+IbGbTFRlnRHPJRcgFZyJpGOzuvRK5rq4gj8FdF8D0HwpnIduzWVDdA7MmEL+mp+KEDxXS5hnl/ic5K9Md0/zUqvKuCp/0MwvC3CCv5YKnkfKHvZYx+QPCRciAhHfEipZRNCLvhHnnX0xdeaw/saLquw5TsgGKOjKsQQYnYNo0T3paw89fgncP6mn9tAYWS1Sg6Gy2gbRTuEGD5fad6y3bQQYeY9+bL4GbYkfiXSbOZsMXFQIDAQAB';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Qatch',
    description: 'Capture bugs with screenshots, recordings, console logs and network requests.',
    key: EXTENSION_PUBLIC_KEY,
    // Permissions are added by the task that first needs them; each is justified in ARCHITECTURE §6.
    permissions: [],
  },
  hooks: {
    // Resolved here rather than in `manifest` so `wxt prepare` (typecheck/lint/postinstall) does not need
    // WXT_API_ORIGIN; only real builds (dev, build, zip) do.
    'build:manifestGenerated': (wxt, manifest) => {
      // Narrows the MV2 | MV3 union so host_permissions is typed (Qatch is MV3 only).
      if (manifest.manifest_version !== 3) throw new Error('Qatch targets Manifest V3 only');
      const origin = resolveApiOrigin(process.env['WXT_API_ORIGIN'], wxt.config.mode);
      // Exactly one origin: the Qatch API for this environment. Never a wildcard.
      const apiPermission = toHostPermission(origin);
      // `wxt dev` adds its own dev-server entries for hot reload; keep those in dev only.
      const devEntries = wxt.config.command === 'serve' ? (manifest.host_permissions ?? []) : [];
      manifest.host_permissions = [...new Set([...devEntries, apiPermission])];
    },
  },
});
