type FeaturePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function FeaturePage({ params }: FeaturePageProps) {
  const { slug } = await params;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-6xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Feature: {slug}</h1>
      <p className="text-sm opacity-80">You have access to this feature.</p>
    </main>
  );
}
