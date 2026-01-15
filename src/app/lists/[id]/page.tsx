import { ListDetailClient } from "./list-detail-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <ListDetailClient listId={id} />;
}
