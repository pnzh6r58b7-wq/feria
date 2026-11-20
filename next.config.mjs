/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // sitio estático (para GitHub Pages)
  basePath: "/feria", // se sirve en https://USUARIO.github.io/feria
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
