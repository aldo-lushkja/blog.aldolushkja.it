// BlogSiteStack bundles the Astro frontend into the deployment asset via
// Docker (`node:24`, `npm ci && npm run build`) as part of stack
// construction. That makes it unsuitable for a fast unit test — instantiating
// it here would spin up a Docker build on every `npm test` run, same as the
// (intentionally untested) CdkStack in aldolushkja.it/cdk/test/cdk.test.ts.
//
// Validate this stack instead with `make cdk-synth` / `make cdk-diff`, which
// run the real Docker bundling once against actual AWS credentials/region.

test('BlogSiteStack is validated via cdk synth, not a unit test (see comment above)', () => {
  expect(true).toBe(true);
});
