import nextra from 'nextra';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const withNextra = nextra({});
const projectRoot = dirname(fileURLToPath(import.meta.url));

export default withNextra({
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: '/:path*/index',
        destination: '/:path*',
        permanent: true,
      },
      {
        source: '/developers/tools/:path*',
        destination: '/tools/:path*',
        permanent: true,
      },
      {
        source: '/users/features/:path*',
        destination: '/features/:path*',
        permanent: true,
      },
      {
        source: '/users/configuration/:path*',
        destination: '/cli/:path*',
        permanent: true,
      },
      {
        source: '/users/ide-integration/:path*',
        destination: '/ide-integration/:path*',
        permanent: true,
      },
      {
        source: '/users/support/:path*',
        destination: '/support/:path*',
        permanent: true,
      },
      {
        source: '/remote-driving',
        destination: '/cli/remote-driving',
        permanent: true,
      },
      {
        source: '/headless',
        destination: '/features/headless',
        permanent: true,
      },
      {
        source: '/sandbox',
        destination: '/features/sandbox',
        permanent: true,
      },
      {
        source: '/checkpointing',
        destination: '/features/checkpointing',
        permanent: true,
      },
      {
        source: '/subagents',
        destination: '/features/subagents',
        permanent: true,
      },
      {
        source: '/token-caching',
        destination: '/features/token-caching',
        permanent: true,
      },
      {
        source: '/welcome-back',
        destination: '/features/welcome-back',
        permanent: true,
      },
      {
        source: '/telemetry',
        destination: '/development/telemetry',
        permanent: true,
      },
      {
        source: '/extension',
        destination: '/extensions/extension',
        permanent: true,
      },
      {
        source: '/troubleshooting',
        destination: '/support/troubleshooting',
        permanent: true,
      },
      {
        source: '/trusted-folders',
        destination: '/cli/trusted-folders',
        permanent: true,
      },
      {
        source: '/ide-companion-spec',
        destination: '/ide-integration/ide-companion-spec',
        permanent: true,
      },
    ];
  },
});
