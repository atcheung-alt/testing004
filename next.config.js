/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Employees (and its onboarding/leave/contract sub-pages) moved from
  // /employees to /hr/employees when the HR Management System got its own
  // shell/sidebar (see src/app/hr/layout.tsx). Any old bookmark or link
  // still pointing at /employees just gets forwarded on — the underlying
  // /api/employees/* routes are untouched, only the staff-facing pages moved.
  async redirects() {
    return [
      { source: "/employees", destination: "/hr/employees", permanent: true },
      { source: "/employees/:path*", destination: "/hr/employees/:path*", permanent: true },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // The CJK font bundled for PDF generation (src/lib/pdf/fonts) is loaded
    // at runtime via fs.readFileSync — Next's automatic file-tracing usually
    // catches that pattern, but PDF generation is reachable from many API
    // routes (pdf/email endpoints, the public sign/pay routes, the cron
    // job). Rather than list each one and risk missing one, force it into
    // every API route's bundle explicitly.
    outputFileTracingIncludes: {
      "/api/**/*": ["./src/lib/pdf/fonts/**", "./src/lib/mpf/**"],
    },
    // Every page in this app (dashboard totals, quotation/invoice status,
    // etc.) is `force-dynamic` and expects live data straight from the DB
    // on every visit. Without this, Next's client-side Router Cache still
    // serves a page from memory for up to 30s after you last viewed it —
    // e.g. mark an invoice Paid, click back to Dashboard within 30s, and
    // "Outstanding" still shows the pre-payment total. Setting this to 0
    // makes every navigation re-fetch fresh server data, matching what
    // `force-dynamic` already guarantees on the server side.
    staleTimes: {
      dynamic: 0,
    },
  },
};

module.exports = nextConfig;
