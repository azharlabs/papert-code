import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { notFound } from 'next/navigation';
import { useMDXComponents as getMDXComponents } from '../../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata(props) {
  const params = await props.params;
  try {
    const { metadata } = await importPage(params.mdxPath);
    return metadata;
  } catch {
    return {};
  }
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props) {
  const params = await props.params;
  let page;
  try {
    page = await importPage(params.mdxPath);
  } catch {
    notFound();
  }

  const { default: MDXContent, toc, metadata, sourceCode } = page;

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
