/**
 * Smoke Test Suite for MoonTech
 * Validates live system health, API endpoints, authentication flows,
 * customer and admin protected routes, and frontend page availability.
 *
 * Run with: npx tsx scripts/smoke-tests.ts
 */

declare const process: any;

const API_BASE = 'http://localhost:5000/api';
const FRONTEND_BASE = 'http://localhost:3000';
const PANEL_BASE = 'http://localhost:5173';

let passed = 0;
let failed = 0;

interface TestResult {
  category: string;
  name: string;
  pass: boolean;
  statusCode?: number;
  error?: string;
}
const results: TestResult[] = [];

async function testEndpoint(
  category: string,
  name: string,
  url: string,
  options: RequestInit = {},
  expectedStatus: number = 200,
  validateBody?: (body: any) => boolean
) {
  try {
    const res = await fetch(url, options);
    let ok = res.status === expectedStatus;
    let body: any = null;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json();
      if (ok && validateBody) {
        ok = validateBody(body);
      }
    }

    if (ok) {
      passed++;
      results.push({ category, name, pass: true, statusCode: res.status });
      console.log(`  \x1b[32m✔ PASS\x1b[0m [${category}] ${name} (Status: ${res.status})`);
    } else {
      failed++;
      const err = `Expected ${expectedStatus}, got ${res.status}`;
      results.push({ category, name, pass: false, statusCode: res.status, error: err });
      console.log(`  \x1b[31m✖ FAIL\x1b[0m [${category}] ${name} (${err})`);
    }
    return { status: res.status, body };
  } catch (e: any) {
    failed++;
    const err = e.message || 'Fetch failed';
    results.push({ category, name, pass: false, error: err });
    console.log(`  \x1b[31m✖ FAIL\x1b[0m [${category}] ${name} (${err})`);
    return { status: 0, body: null };
  }
}

async function runSmokeTests() {
  console.log('\n======================================================');
  console.log('         MOONTECH SOLUTIONS - SMOKE TEST SUITE        ');
  console.log('======================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Service Port Liveness Checks
  // ---------------------------------------------------------------------------
  console.log('\x1b[36m--- Group 1: Service Availability & Liveness ---\x1b[0m');
  await testEndpoint('Liveness', 'Backend API is listening on port 5000', `${API_BASE}/investment-plans`, {}, 200);
  await testEndpoint('Liveness', 'Frontend Next.js app is listening on port 3000', `${FRONTEND_BASE}/`, {}, 200);
  await testEndpoint('Liveness', 'Admin Panel Vite app is listening on port 5173', `${PANEL_BASE}/`, {}, 200);

  // ---------------------------------------------------------------------------
  // 2. Authentication Smoke Tests
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[36m--- Group 2: Authentication & Token Generation ---\x1b[0m');
  
  // Admin Login
  const adminRes = await testEndpoint(
    'Auth',
    'Admin login (admin@moontech.com)',
    `${API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@moontech.com', password: 'Admin@123456' }),
    },
    200,
    (body) => body.success === true && typeof body.data?.accessToken === 'string' && body.data.user?.role === 'ADMIN'
  );
  const adminToken = adminRes.body?.data?.accessToken || '';

  // Customer Login
  const customerRes = await testEndpoint(
    'Auth',
    'Customer login (priya.patel@example.com)',
    `${API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya.patel@example.com', password: 'Admin@123456' }),
    },
    200,
    (body) => body.success === true && typeof body.data?.accessToken === 'string' && body.data.user?.role === 'CUSTOMER'
  );
  const customerToken = customerRes.body?.data?.accessToken || '';

  // Invalid Login Rejection
  await testEndpoint(
    'Auth',
    'Invalid credentials rejection (401)',
    `${API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'WrongPassword123' }),
    },
    401
  );

  // ---------------------------------------------------------------------------
  // 3. Public API Endpoints
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[36m--- Group 3: Public API Endpoints ---\x1b[0m');
  await testEndpoint(
    'Public API',
    'GET /api/investment-plans (returns dynamic active plans)',
    `${API_BASE}/investment-plans`,
    {},
    200,
    (body) => Array.isArray(body.data) && body.data.length > 0 && body.data.every((p: any) => p.name && p.durationDays)
  );

  await testEndpoint(
    'Public API',
    'GET /api/investment-plans/featured (returns featured plans)',
    `${API_BASE}/investment-plans/featured`,
    {},
    200,
    (body) => Array.isArray(body.data)
  );

  // ---------------------------------------------------------------------------
  // 4. Customer Protected API Routes
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[36m--- Group 4: Customer Protected Routes ---\x1b[0m');
  if (customerToken) {
    const authHeader = { Authorization: `Bearer ${customerToken}` };

    await testEndpoint(
      'Customer API',
      'GET /api/profile (Customer account details)',
      `${API_BASE}/profile`,
      { headers: authHeader },
      200,
      (body) => body.data?.email === 'priya.patel@example.com'
    );

    await testEndpoint(
      'Customer API',
      'GET /api/wallet (Wallet balance and payment config)',
      `${API_BASE}/wallet`,
      { headers: authHeader },
      200,
      (body) => typeof body.data?.balance === 'number' && typeof body.data?.config?.minTopup === 'number'
    );

    await testEndpoint(
      'Customer API',
      'GET /api/investments (Customer investments list)',
      `${API_BASE}/investments`,
      { headers: authHeader },
      200,
      (body) => Array.isArray(body.data)
    );

    await testEndpoint(
      'Customer API',
      'GET /api/notifications (User notifications)',
      `${API_BASE}/notifications`,
      { headers: authHeader },
      200,
      (body) => Array.isArray(body.data)
    );

    await testEndpoint(
      'Customer API',
      'GET /api/notifications/unread-count (Unread notification count)',
      `${API_BASE}/notifications/unread-count`,
      { headers: authHeader },
      200,
      (body) => typeof body.data?.unreadCount === 'number'
    );
  } else {
    console.log('  \x1b[33m⚠ SKIPPED\x1b[0m Customer protected endpoints (missing token)');
  }

  // ---------------------------------------------------------------------------
  // 5. Admin Protected API Routes
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[36m--- Group 5: Admin Protected Routes ---\x1b[0m');
  if (adminToken) {
    const adminHeader = { Authorization: `Bearer ${adminToken}` };

    await testEndpoint(
      'Admin API',
      'GET /api/admin/finance/dashboard (Financial dashboard metrics)',
      `${API_BASE}/admin/finance/dashboard`,
      { headers: adminHeader },
      200,
      (body) => body.success === true && typeof body.data === 'object'
    );

    await testEndpoint(
      'Admin API',
      'GET /api/admin/investment-plans (Plans with investment aggregates)',
      `${API_BASE}/admin/investment-plans`,
      { headers: adminHeader },
      200,
      (body) => Array.isArray(body.data)
    );

    await testEndpoint(
      'Admin API',
      'GET /api/admin/settings (Platform limits & UPI configuration)',
      `${API_BASE}/admin/settings`,
      { headers: adminHeader },
      200,
      (body) => body.success === true && typeof body.data?.walletMinTopup === 'number'
    );
  } else {
    console.log('  \x1b[33m⚠ SKIPPED\x1b[0m Admin protected endpoints (missing token)');
  }

  // ---------------------------------------------------------------------------
  // 6. Frontend Web Routes (Next.js)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[36m--- Group 6: Frontend Pages (Next.js on :3000) ---\x1b[0m');
  const frontendPages = [
    { name: 'Home Page', path: '/' },
    { name: 'Sign In Page', path: '/login' },
    { name: 'Register Page', path: '/register' },
    { name: 'Investment Plans Page', path: '/plans' },
    { name: 'Returns Calculator Page', path: '/calculator' },
    { name: 'Featured Offers Page', path: '/offers' },
    { name: 'Wallet Page', path: '/wallet' },
    { name: 'Customer Dashboard Page', path: '/dashboard' },
  ];

  for (const page of frontendPages) {
    await testEndpoint('Frontend', `Page: ${page.name} (${page.path})`, `${FRONTEND_BASE}${page.path}`, {}, 200);
  }

  // ---------------------------------------------------------------------------
  // 7. Admin Panel Routes (Vite SPA)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[36m--- Group 7: Admin Panel (Vite SPA on :5173) ---\x1b[0m');
  await testEndpoint('Panel', 'Admin Panel Root Route (/)', `${PANEL_BASE}/`, {}, 200);
  await testEndpoint('Panel', 'Admin Panel Login Route (/login)', `${PANEL_BASE}/login`, {}, 200);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`SMOKE TEST RESULTS: \x1b[32m${passed} PASSED\x1b[0m, \x1b[31m${failed} FAILED\x1b[0m (Total: ${passed + failed})`);
  console.log('======================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runSmokeTests();
