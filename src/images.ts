import { MAX_IMAGE_BYTES, uid, type AuditImage, type Project } from "./model";
export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.src = "";
      reject(
        Error(
          "Image could not be decoded. Try exporting it as a new PNG or JPEG.",
        ),
      );
    }, 10000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(
        Error("Image could not be read. Choose a valid PNG, JPEG, or WebP."),
      );
    };
    image.src = source;
  });
}
export async function processImage(
  file: File,
  logo = false,
): Promise<AuditImage> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error(
      `${file.name}: use PNG, JPEG, or WebP. SVG and animated formats are not supported.`,
    );
  if (file.size > MAX_IMAGE_BYTES)
    throw Error(`${file.name}: image exceeds 10 MB. Choose a smaller file.`);
  if (!file.size) throw Error(`${file.name}: this image is empty.`);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.naturalWidth * image.naturalHeight > 40000000)
      throw Error(
        `${file.name}: image exceeds 40 megapixels. Resize it before uploading.`,
      );
    const ratio = Math.min(
      1,
      (logo ? 800 : 2048) / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL(logo ? "image/png" : "image/webp", 0.84);
    if (dataUrl.length > 2800000)
      dataUrl = canvas.toDataURL("image/webp", 0.68);
    if (dataUrl.length > 2800000)
      throw Error(
        `${file.name}: image is still too large after resizing. Use a smaller image.`,
      );
    return {
      id: uid(),
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      caption: "",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function verifyProjectImages(project: Project): Promise<void> {
  const images = [
    ...(project.branding.logo ? [project.branding.logo] : []),
    ...project.findings.flatMap((f) => f.screenshots),
  ];
  for (const saved of images) {
    const image = await loadImage(saved.dataUrl);
    if (
      image.naturalWidth !== saved.width ||
      image.naturalHeight !== saved.height
    )
      throw Error("An image has incorrect dimensions. Project was not opened.");
  }
}
