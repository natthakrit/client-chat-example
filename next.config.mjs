/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'imagedelivery.net',
            port: '',
            pathname: "/**",
          },
          {
            protocol: 'https',
            hostname: 'dummyimage.com',
            port: '',
            pathname: "/**",
          }
        ],
      }
};

export default nextConfig;
