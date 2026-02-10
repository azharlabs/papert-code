import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Banner, Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';

export const metadata = {
  title: {
    default: 'Papert Code Docs',
    template: '%s - Papert Code Docs',
  },
  description: 'Documentation for Papert Code CLI, desktop app, tools, and integrations.',
};

const banner = (
  <Banner storageKey="papert-docs-banner">
    Papert Code docs are now available with section-based navigation.
  </Banner>
);

const navbar = (
  <Navbar
    logo={<b>Papert Code</b>}
    projectLink="https://github.com/azharlabs/papert-code"
  />
);

const footer = <Footer>Apache-2.0 {new Date().getFullYear()} © Papert Code.</Footer>;

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          banner={banner}
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/azharlabs/papert-code/tree/main/docs"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          footer={footer}
          search={true}
          darkMode={true}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
