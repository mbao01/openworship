import { useEffect, useState } from "react";
import { readThumbnail } from "../../../lib/commands/artifacts";

export function ThumbnailImage({
  artifactId,
  thumbnailPath,
  className,
}: {
  artifactId: string;
  thumbnailPath: string | null;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailPath) return;
    let revoked = false;
    let url: string | null = null;
    readThumbnail(artifactId)
      .then((bytes) => {
        if (revoked) return;
        const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [artifactId, thumbnailPath]);

  if (!thumbnailPath || !src) {
    return null;
  }
  return (
    <img
      src={src}
      alt=""
      className={className || "h-full w-full rounded object-cover"}
    />
  );
}
