export function ThumbnailImage({
  artifactId,
  thumbnailPath,
  className,
}: {
  artifactId: string;
  thumbnailPath: string | null;
  className?: string;
}) {
  if (!thumbnailPath) {
    return null;
  }
  return (
    <img
      src={`owmedia://localhost/thumbnail/${artifactId}`}
      alt=""
      className={className || "h-full w-full rounded object-cover"}
    />
  );
}
