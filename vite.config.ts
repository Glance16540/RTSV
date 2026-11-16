import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // A test has twenty seconds, not the default five. Many of the campaign tests play whole worlds and take three
  // to five seconds alone; with several sessions running the suite on one machine they went over five and failed
  // for no fault of their own. A test that needs longer than this still says so itself.
  test: { testTimeout: 20_000 },
});
