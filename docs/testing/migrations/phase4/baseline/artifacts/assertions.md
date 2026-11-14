# Assertion preservation inventory

1630 original matcher-call sites, identified by source location and expression SHA-256. Each site can execute zero, one or multiple times due to branches, request handlers, loops and polling. These are not runtime assertion totals.

Every site maps to at least one original test candidate. Future mappings remain unassigned. No assertions were changed.

## apps/web/e2e/admin.spec.ts

### apps/web/e2e/admin.spec.ts:32:13

[apps/web/e2e/admin.spec.ts:32](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts:32); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-001, PW-003, PW-005, PW-007, PW-009.

All possible owners, including helper/route/hook candidates: PW-001, PW-003, PW-005, PW-007, PW-009.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/admin.spec.ts:33:13

[apps/web/e2e/admin.spec.ts:33](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts:33); SHA-256 `b1f1dab8b30b4d0fe2f9952e77802098b495ffd43d8ba08fdfb0f6ce2e159856`.

Direct callback owners: PW-001, PW-003, PW-005, PW-007, PW-009.

All possible owners, including helper/route/hook candidates: PW-001, PW-003, PW-005, PW-007, PW-009.

```ts
expect(
        page.getByRole("heading", { name: feature.title }),
      ).toHaveCount(0)
```

### apps/web/e2e/admin.spec.ts:36:7

[apps/web/e2e/admin.spec.ts:36](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts:36); SHA-256 `bfe72696486336fd893dc834f7a2489223e920e32c8618e77a8f7fab1dfc7bec`.

Direct callback owners: PW-001, PW-003, PW-005, PW-007, PW-009.

All possible owners, including helper/route/hook candidates: PW-001, PW-003, PW-005, PW-007, PW-009.

```ts
expect(requests).toEqual([])
```

### apps/web/e2e/admin.spec.ts:47:13

[apps/web/e2e/admin.spec.ts:47](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts:47); SHA-256 `53cf4d1e244c685b04a770dd9bf3c1d2514a06462706dd5463345942242fe2f2`.

Direct callback owners: PW-002, PW-004, PW-006, PW-008, PW-010.

All possible owners, including helper/route/hook candidates: PW-002, PW-004, PW-006, PW-008, PW-010.

```ts
expect(
        page.getByText(
          "We couldn’t load your account. Please refresh to try again.",
        ),
      ).toBeVisible()
```

### apps/web/e2e/admin.spec.ts:52:13

[apps/web/e2e/admin.spec.ts:52](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts:52); SHA-256 `b1f1dab8b30b4d0fe2f9952e77802098b495ffd43d8ba08fdfb0f6ce2e159856`.

Direct callback owners: PW-002, PW-004, PW-006, PW-008, PW-010.

All possible owners, including helper/route/hook candidates: PW-002, PW-004, PW-006, PW-008, PW-010.

```ts
expect(
        page.getByRole("heading", { name: feature.title }),
      ).toHaveCount(0)
```

## apps/web/e2e/auth-performance.spec.ts

### apps/web/e2e/auth-performance.spec.ts:31:7

[apps/web/e2e/auth-performance.spec.ts:31](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:31); SHA-256 `e01355550bce0d41cefd3531b6a48c5e5794726cd34bc0077b2a7c010608f966`.

Direct callback owners: PW-011, PW-012.

All possible owners, including helper/route/hook candidates: PW-011, PW-012.

```ts
expect(link).toContain(
        `<${new URL(preloadedFont).pathname}>; rel=preload; as="font"; crossorigin=""`,
      )
```

### apps/web/e2e/auth-performance.spec.ts:40:11

[apps/web/e2e/auth-performance.spec.ts:40](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:40); SHA-256 `cd1a81f74a662bbfba21032ea436aa4ef8338502a93a6e6eab02526676e4e629`.

Direct callback owners: PW-011, PW-012.

All possible owners, including helper/route/hook candidates: PW-011, PW-012.

```ts
expect(
      page.getByLabel("Email address", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/auth-performance.spec.ts:44:5

[apps/web/e2e/auth-performance.spec.ts:44](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:44); SHA-256 `5361726e90bf4884899d5711e4021d5ff91a4858a26d136b6d609487a7126b0f`.

Direct callback owners: PW-011, PW-012.

All possible owners, including helper/route/hook candidates: PW-011, PW-012.

```ts
expect(fonts).toEqual([preloadedFont])
```

### apps/web/e2e/auth-performance.spec.ts:55:3

[apps/web/e2e/auth-performance.spec.ts:55](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:55); SHA-256 `30b6df5c3a9e5cadf3689888fc5ff29b3c6e67a7e87bef458b9a44da3f92814a`.

Direct callback owners: PW-013.

All possible owners, including helper/route/hook candidates: PW-013.

```ts
expect(response?.status()).toBe(200)
```

### apps/web/e2e/auth-performance.spec.ts:56:9

[apps/web/e2e/auth-performance.spec.ts:56](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:56); SHA-256 `b5d42c7f748abf04d19b663fb457e6149f17a90c9af98708ffccc859ab67dcb8`.

Direct callback owners: PW-013.

All possible owners, including helper/route/hook candidates: PW-013.

```ts
expect(page.getByLabel("Email address", { exact: true })).toBeVisible()
```

### apps/web/e2e/auth-performance.spec.ts:57:9

[apps/web/e2e/auth-performance.spec.ts:57](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:57); SHA-256 `6308946f7d79632fb28212c9c6359017c1d16ee75a3d0128d43ab5ccdd4feb6c`.

Direct callback owners: PW-013.

All possible owners, including helper/route/hook candidates: PW-013.

```ts
expect(page.getByLabel("Password", { exact: true })).toBeVisible()
```

### apps/web/e2e/auth-performance.spec.ts:58:9

[apps/web/e2e/auth-performance.spec.ts:58](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:58); SHA-256 `96399a955b1ed79af2b647dfab4fcf40d60ca88efa933b3519b4000e5cfc8144`.

Direct callback owners: PW-013.

All possible owners, including helper/route/hook candidates: PW-013.

```ts
expect(page.locator("main[lang]")).toHaveCSS("display", "grid")
```

### apps/web/e2e/auth-performance.spec.ts:60:9

[apps/web/e2e/auth-performance.spec.ts:60](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:60); SHA-256 `ee00d9c1dd8e2eb207547e63af6663b2808ed1006fe1c327243c62199f8370d8`.

Direct callback owners: PW-013.

All possible owners, including helper/route/hook candidates: PW-013.

```ts
expect(page.locator("main[lang]")).toHaveCSS("display", "block")
```

### apps/web/e2e/auth-performance.spec.ts:61:9

[apps/web/e2e/auth-performance.spec.ts:61](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:61); SHA-256 `bf3e014ac4055d83fdbe9a9c6ec1bb3bc6c1b2c6e0476ccbb887f4cb3c9531d7`.

Direct callback owners: PW-013.

All possible owners, including helper/route/hook candidates: PW-013.

```ts
expect(page.locator("aside")).toBeHidden()
```

### apps/web/e2e/auth-performance.spec.ts:74:9

[apps/web/e2e/auth-performance.spec.ts:74](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:74); SHA-256 `7d84e0c487d3a835e30eab068264a6df0c75581c0dc37b4d1e9bbd8931cfbf33`.

Direct callback owners: PW-014.

All possible owners, including helper/route/hook candidates: PW-014.

```ts
expect(page.locator('input[type="email"]')).toBeVisible()
```

### apps/web/e2e/auth-performance.spec.ts:76:3

[apps/web/e2e/auth-performance.spec.ts:76](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:76); SHA-256 `d2ae266b5e452d69d4a5746b8fefe9fa6be6b25ea3883c220cbc8c17b5b90307`.

Direct callback owners: PW-014.

All possible owners, including helper/route/hook candidates: PW-014.

```ts
expect(photos).toEqual([])
```

### apps/web/e2e/auth-performance.spec.ts:89:3

[apps/web/e2e/auth-performance.spec.ts:89](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:89); SHA-256 `260836517f0aaeadd6237cd7f617610493d704cb047acdde6786964488cd6a15`.

Direct callback owners: PW-015.

All possible owners, including helper/route/hook candidates: PW-015.

```ts
expect(response.status()).toBe(200)
```

### apps/web/e2e/auth-performance.spec.ts:90:3

[apps/web/e2e/auth-performance.spec.ts:90](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:90); SHA-256 `1c60f07d54c9d33b42aaff7b578de9213db7e6eecbc7207bef6b03648a5ae457`.

Direct callback owners: PW-015.

All possible owners, including helper/route/hook candidates: PW-015.

```ts
expect(response.headers()["content-type"]).toBe("image/webp")
```

### apps/web/e2e/auth-performance.spec.ts:91:3

[apps/web/e2e/auth-performance.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:91); SHA-256 `d7cbcffe41414c08f2b29487d7b2dd059ac6777d5482fe6d17d4e2085c5552d5`.

Direct callback owners: PW-015.

All possible owners, including helper/route/hook candidates: PW-015.

```ts
expect((await response.body()).length).toBeLessThan(100_000)
```

### apps/web/e2e/auth-performance.spec.ts:104:3

[apps/web/e2e/auth-performance.spec.ts:104](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:104); SHA-256 `8cb9e55df003efb753f0fc2854f21b1579f79747060b3826fde8b996db4212cd`.

Direct callback owners: PW-015.

All possible owners, including helper/route/hook candidates: PW-015.

```ts
expect(width).toBe(828)
```

### apps/web/e2e/auth-performance.spec.ts:115:9

[apps/web/e2e/auth-performance.spec.ts:115](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:115); SHA-256 `7c9b0dc3ebde410a9fd4796cebaa7f55b89b6989997cdad976483ac1f65df524`.

Direct callback owners: PW-016.

All possible owners, including helper/route/hook candidates: PW-016.

```ts
expect(first).toHaveAttribute("aria-current", "true")
```

### apps/web/e2e/auth-performance.spec.ts:118:9

[apps/web/e2e/auth-performance.spec.ts:118](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:118); SHA-256 `c092670efa610933135bfa41833d075158ea0130d8db6d4e3b4dfbc7af52eb09`.

Direct callback owners: PW-016.

All possible owners, including helper/route/hook candidates: PW-016.

```ts
expect(second).toHaveAttribute("aria-current", "true")
```

### apps/web/e2e/auth-performance.spec.ts:119:9

[apps/web/e2e/auth-performance.spec.ts:119](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:119); SHA-256 `e638f2435c0cfb533ba68653212c5080910c2cdbb7328b3f726cb3a53b926883`.

Direct callback owners: PW-016.

All possible owners, including helper/route/hook candidates: PW-016.

```ts
expect
    .poll(() =>
      page
        .locator("aside img")
        .last()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(1)
```

### apps/web/e2e/auth-performance.spec.ts:135:9

[apps/web/e2e/auth-performance.spec.ts:135](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:135); SHA-256 `c189a7973e38d42d11f07d857f25ca82c4bba98f1ff5e20f85e3e627accfeb00`.

Direct callback owners: PW-017.

All possible owners, including helper/route/hook candidates: PW-017.

```ts
expect(page.locator("aside")).toBeVisible()
```

### apps/web/e2e/auth-performance.spec.ts:136:9

[apps/web/e2e/auth-performance.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:136); SHA-256 `e638f2435c0cfb533ba68653212c5080910c2cdbb7328b3f726cb3a53b926883`.

Direct callback owners: PW-017.

All possible owners, including helper/route/hook candidates: PW-017.

```ts
expect
    .poll(() =>
      page
        .locator("aside img")
        .last()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(1)
```

### apps/web/e2e/auth-performance.spec.ts:173:5

[apps/web/e2e/auth-performance.spec.ts:173](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:173); SHA-256 `a3b5b114e100c069a907de46eefcc6e2b7de27c726a45cab44358b7f0004e6c8`.

Direct callback owners: PW-018.

All possible owners, including helper/route/hook candidates: PW-018.

```ts
expect(dimensions.decodedHeight).toBeGreaterThanOrEqual(
      Math.min(index === 3 ? 793 : 941, dimensions.panelHeight),
    )
```

## apps/web/e2e/auth-styles.spec.ts

### apps/web/e2e/auth-styles.spec.ts:26:5

[apps/web/e2e/auth-styles.spec.ts:26](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:26); SHA-256 `30b6df5c3a9e5cadf3689888fc5ff29b3c6e67a7e87bef458b9a44da3f92814a`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(response?.status()).toBe(200)
```

### apps/web/e2e/auth-styles.spec.ts:27:11

[apps/web/e2e/auth-styles.spec.ts:27](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:27); SHA-256 `7d84e0c487d3a835e30eab068264a6df0c75581c0dc37b4d1e9bbd8931cfbf33`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(page.locator('input[type="email"]')).toBeVisible()
```

### apps/web/e2e/auth-styles.spec.ts:28:11

[apps/web/e2e/auth-styles.spec.ts:28](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:28); SHA-256 `42416054c3c062b4d386e2502d40ca38ba9713844901529616ba99dcc0dec33e`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(page.locator("body")).toHaveCSS("margin", "0px")
```

### apps/web/e2e/auth-styles.spec.ts:37:7

[apps/web/e2e/auth-styles.spec.ts:37](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:37); SHA-256 `ccdfbc8da1dfdf9f1607a1b20e9edb9a6cde0054f5c70b879d17688d3b206ad2`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(style.nonce).toBeTruthy()
```

### apps/web/e2e/auth-styles.spec.ts:38:7

[apps/web/e2e/auth-styles.spec.ts:38](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:38); SHA-256 `d784f53b62a98fea1b46fd788198cf5c7d7eb8e316d1a7743fb340d39b7b2844`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(style.content).toBeTruthy()
```

### apps/web/e2e/auth-styles.spec.ts:40:5

[apps/web/e2e/auth-styles.spec.ts:40](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:40); SHA-256 `a34808b038df89b8a037f339564396c28a151fc7222871c6aad5db983d739d19`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(stylesheets.length).toBeGreaterThan(0)
```

### apps/web/e2e/auth-styles.spec.ts:42:7

[apps/web/e2e/auth-styles.spec.ts:42](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:42); SHA-256 `1b1d423d46936107adc87cec53ebf70fd543fadd194e9e5e153d4aa80da961db`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(new URL(url).pathname).toMatch(/^\/_next\/static\/.*\.css$/)
```

### apps/web/e2e/auth-styles.spec.ts:48:9

[apps/web/e2e/auth-styles.spec.ts:48](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:48); SHA-256 `1a1e4da9eb292359fc46e6f2aa6dc339f305314664d14f551753ef76135d3fbf`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(response.ok()).toBe(true)
```

### apps/web/e2e/auth-styles.spec.ts:52:5

[apps/web/e2e/auth-styles.spec.ts:52](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:52); SHA-256 `eec110f0016d53d7e4001134ee30d3199f2e7c2b8e0a240707c3ef4dbe5d29fe`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(css.reduce((bytes, body) => bytes + body.length, 0)).toBeLessThan(
      80_000,
    )
```

### apps/web/e2e/auth-styles.spec.ts:55:5

[apps/web/e2e/auth-styles.spec.ts:55](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:55); SHA-256 `b222699044ff45ec03c22039484910370c0b61c1872e76f813f543257991c5db`.

Direct callback owners: PW-019, PW-020.

All possible owners, including helper/route/hook candidates: PW-019, PW-020.

```ts
expect(policyViolations).toEqual([])
```

### apps/web/e2e/auth-styles.spec.ts:65:9

[apps/web/e2e/auth-styles.spec.ts:65](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:65); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/auth-styles.spec.ts:67:9

[apps/web/e2e/auth-styles.spec.ts:67](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:67); SHA-256 `d2df3eb88b9e5a12578864e04a6d4eddb6a01aac29f9588b7e82b73398db82e8`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(dashboard).toHaveCSS("border-radius", "13px")
```

### apps/web/e2e/auth-styles.spec.ts:68:9

[apps/web/e2e/auth-styles.spec.ts:68](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:68); SHA-256 `cfe04c9571fb602a370de4cf0ee3acc93ee573da9136ec9a9c164913ec29b990`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(dashboard).toHaveCSS("background-color", "rgb(243, 247, 249)")
```

### apps/web/e2e/auth-styles.spec.ts:71:9

[apps/web/e2e/auth-styles.spec.ts:71](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:71); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/auth-styles.spec.ts:72:9

[apps/web/e2e/auth-styles.spec.ts:72](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:72); SHA-256 `96399a955b1ed79af2b647dfab4fcf40d60ca88efa933b3519b4000e5cfc8144`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(page.locator("main[lang]")).toHaveCSS("display", "grid")
```

### apps/web/e2e/auth-styles.spec.ts:74:9

[apps/web/e2e/auth-styles.spec.ts:74](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:74); SHA-256 `ee00d9c1dd8e2eb207547e63af6663b2808ed1006fe1c327243c62199f8370d8`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(page.locator("main[lang]")).toHaveCSS("display", "block")
```

### apps/web/e2e/auth-styles.spec.ts:75:9

[apps/web/e2e/auth-styles.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:75); SHA-256 `bf3e014ac4055d83fdbe9a9c6ec1bb3bc6c1b2c6e0476ccbb887f4cb3c9531d7`.

Direct callback owners: PW-021.

All possible owners, including helper/route/hook candidates: PW-021.

```ts
expect(page.locator("aside")).toBeHidden()
```

## apps/web/e2e/booked-services.spec.ts

### apps/web/e2e/booked-services.spec.ts:40:9

[apps/web/e2e/booked-services.spec.ts:40](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:40); SHA-256 `54a5eb3b6810add2eb8d4d7cde62a344d1c2734744b8c290fed2427d2a76690f`.

Direct callback owners: PW-022.

All possible owners, including helper/route/hook candidates: PW-022.

```ts
expect(page.getByText("Submitted", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:43:9

[apps/web/e2e/booked-services.spec.ts:43](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:43); SHA-256 `54a5eb3b6810add2eb8d4d7cde62a344d1c2734744b8c290fed2427d2a76690f`.

Direct callback owners: PW-022.

All possible owners, including helper/route/hook candidates: PW-022.

```ts
expect(page.getByText("Submitted", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:45:9

[apps/web/e2e/booked-services.spec.ts:45](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:45); SHA-256 `dd42da00daffa4ac7c886b01089bb048b51db6d2cc0e5caa7b371df728b0ec9e`.

Direct callback owners: PW-022.

All possible owners, including helper/route/hook candidates: PW-022.

```ts
expect(page.getByText("Under review", { exact: true })).toBeVisible({
    timeout: 10_000,
  })
```

### apps/web/e2e/booked-services.spec.ts:56:9

[apps/web/e2e/booked-services.spec.ts:56](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:56); SHA-256 `71022ff0e91f627f51888733dcf7e336b09c03b21e8f3a65e6d796b992c14dda`.

Direct callback owners: PW-022.

All possible owners, including helper/route/hook candidates: PW-022.

```ts
expect(
    page
      .getByRole("table", { name: "Booked services", exact: true })
      .getByRole("alert"),
  ).toHaveCount(0)
```

### apps/web/e2e/booked-services.spec.ts:61:9

[apps/web/e2e/booked-services.spec.ts:61](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:61); SHA-256 `82d4b3ee51ac39591ca3051f851afb41575bcb8469d0753de167e325a5c88ce6`.

Direct callback owners: PW-022.

All possible owners, including helper/route/hook candidates: PW-022.

```ts
expect(page.getByText("Under review", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:65:9

[apps/web/e2e/booked-services.spec.ts:65](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:65); SHA-256 `0777040ba11ba3169405218129004a0a0d85cd58c97dd11c28e47304800421f9`.

Direct callback owners: PW-022.

All possible owners, including helper/route/hook candidates: PW-022.

```ts
expect(page.getByText("Cancelled", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:112:5

[apps/web/e2e/booked-services.spec.ts:112](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:112); SHA-256 `169370ba1b07ac39824c84e67c2a2f8a05e3f286b3c60d136b8dc9751790605e`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-022, PW-023, PW-024, PW-025, PW-026, PW-027, PW-028, PW-029, PW-030.

```ts
expect(request.headers().authorization).toBe("Bearer test-session")
```

### apps/web/e2e/booked-services.spec.ts:224:11

[apps/web/e2e/booked-services.spec.ts:224](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:224); SHA-256 `a0f38a66018189a83aa8e2531ec45a9af23ca8b5549b511a9ef09e41e3f62476`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      main.getByRole("heading", { name: "Booked Services", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:227:11

[apps/web/e2e/booked-services.spec.ts:227](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:227); SHA-256 `ed6139ec46b2bd82997c8e1d18a952759c08ac5215eeb711fd291fcbe25649d9`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(10)
```

### apps/web/e2e/booked-services.spec.ts:230:11

[apps/web/e2e/booked-services.spec.ts:230](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:230); SHA-256 `09ce47554c6db8eb6f44d3f4e74d1e194e71200a1bd4ed78c41e79458cc49af9`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(table.getByText("Submitted", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:231:11

[apps/web/e2e/booked-services.spec.ts:231](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:231); SHA-256 `88e349bddc3aa7d81b49ccf398bd1d7e4ef87c37e186de3d4f5602e15517e59d`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(table.getByText("Under review", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:232:11

[apps/web/e2e/booked-services.spec.ts:232](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:232); SHA-256 `40c759525726edd2e62634fcecb5b0b6b2de7a869bff1519244dba692ae4df8b`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByText("Awaiting information", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:235:11

[apps/web/e2e/booked-services.spec.ts:235](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:235); SHA-256 `4d1002b0b77cc910074c218671598f16272534ebc26889e559cc61e9c067db56`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      main.getByText("Showing 1–10 of 11", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:238:11

[apps/web/e2e/booked-services.spec.ts:238](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:238); SHA-256 `539bd66d001c6ed3fbb25ee3c661081de9447c132746cf30264f4d4c92e81f62`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      main.getByRole("link", { name: "Browse Services", exact: true }),
    ).toHaveAttribute("href", "/services")
```

### apps/web/e2e/booked-services.spec.ts:247:11

[apps/web/e2e/booked-services.spec.ts:247](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:247); SHA-256 `8ee36ce8e677861ecc62aede123eff492a0652ec8161c9be4168421b83587609`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      navigation.getByRole("link", { name: "Booked Services", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/booked-services.spec.ts:260:11

[apps/web/e2e/booked-services.spec.ts:260](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:260); SHA-256 `cfa8fe3b6d9a82bd94135d32922daa575cd11eba0abef6f5a13203acda4631b4`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", {
        name: "View booking request-11",
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:266:11

[apps/web/e2e/booked-services.spec.ts:266](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:266); SHA-256 `6a5ed1951d6719c9caccfd404b16c161325e773cacfeb4be746dd73921816f36`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      main.getByText("Showing 11–11 of 11", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:272:11

[apps/web/e2e/booked-services.spec.ts:272](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:272); SHA-256 `06f4fa88e26a3af36f57884476830410ac71b9fb6c2df8e75e3ae4de5dbde78d`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", {
        name: "View booking request-1",
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:278:11

[apps/web/e2e/booked-services.spec.ts:278](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:278); SHA-256 `4629b1be2a8a4eba497c89f4f82070d831fe5d2cdfcb4540d08898832980c030`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      main.getByText("Showing 1–1 of 1", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:281:5

[apps/web/e2e/booked-services.spec.ts:281](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:281); SHA-256 `65fd7ef4bd59611370b81d751fbf1fccfe9e319c5966487954a37920237f64df`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(state.listQueries.at(-1)).toEqual({
      search: "Website",
      status: "",
      page: 1,
    })
```

### apps/web/e2e/booked-services.spec.ts:289:11

[apps/web/e2e/booked-services.spec.ts:289](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:289); SHA-256 `4d1002b0b77cc910074c218671598f16272534ebc26889e559cc61e9c067db56`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      main.getByText("Showing 1–10 of 11", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:298:11

[apps/web/e2e/booked-services.spec.ts:298](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:298); SHA-256 `cb76de721a77a1260fddbb3fde2dd7a11cc88eadfc8e5d166e01396d4c3763fb`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(1)
```

### apps/web/e2e/booked-services.spec.ts:301:11

[apps/web/e2e/booked-services.spec.ts:301](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:301); SHA-256 `11246c13c199c72248b2d00edfc659ac610407d4f5badfc8ae67b9233d0188a9`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", {
        name: "View booking request-2",
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:307:5

[apps/web/e2e/booked-services.spec.ts:307](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:307); SHA-256 `76c2221a348955785d786f1de1c9e8ac7c80f604cffc9c2112fd1213c2721963`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(state.listQueries.at(-1)).toEqual({
      search: "",
      status: "UNDER_REVIEW",
      page: 1,
    })
```

### apps/web/e2e/booked-services.spec.ts:315:11

[apps/web/e2e/booked-services.spec.ts:315](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:315); SHA-256 `895f6382ec6b29679e23081cb10b70e68f87985d96ec384cbbd2487f187346a0`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(table.getByRole("status")).toContainText("No results for")
```

### apps/web/e2e/booked-services.spec.ts:316:11

[apps/web/e2e/booked-services.spec.ts:316](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:316); SHA-256 `2db9e34701fb28eaf3c4024d5f211ad31f829cdb83c1d23b4fa6c5ef2c81a6de`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(0)
```

### apps/web/e2e/booked-services.spec.ts:322:11

[apps/web/e2e/booked-services.spec.ts:322](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:322); SHA-256 `ed6139ec46b2bd82997c8e1d18a952759c08ac5215eeb711fd291fcbe25649d9`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      table.getByRole("button", { name: /^View booking / }),
    ).toHaveCount(10)
```

### apps/web/e2e/booked-services.spec.ts:325:5

[apps/web/e2e/booked-services.spec.ts:325](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:325); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-023, PW-025.

All possible owners, including helper/route/hook candidates: PW-023, PW-025.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/booked-services.spec.ts:347:11

[apps/web/e2e/booked-services.spec.ts:347](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:347); SHA-256 `6f6af4e88f73605831fabc112b4cf2dd5dcf98850670cd470ad1b540a4763950`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByRole("heading", { name: "Website Development", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:350:11

[apps/web/e2e/booked-services.spec.ts:350](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:350); SHA-256 `aa81a42a141ebf96294d67e3b67832e40e920370dc39c9cf10e29a72530ac240`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(drawer.getByText("request-1", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:351:11

[apps/web/e2e/booked-services.spec.ts:351](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:351); SHA-256 `047506937d4c2bd746047ae5470ba3496fcc4a1ba91bc76f4b3830a6c7a0a7d6`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByText("Business Website", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:354:11

[apps/web/e2e/booked-services.spec.ts:354](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:354); SHA-256 `aa5e80d787a34c11d38f48d511d44cc6a8e16e09dc85073f23265461e9ffcdbd`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByText("Sam Developer", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:357:11

[apps/web/e2e/booked-services.spec.ts:357](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:357); SHA-256 `26fa0cf2abf27845da32fb6318fd3b15e41717e66c1e47e70faa6d1c21df356f`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByText("Launch within six weeks", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:360:11

[apps/web/e2e/booked-services.spec.ts:360](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:360); SHA-256 `ee3d9a64d72844e40f17023262ecf7190684888da30d3a75c01eefec91079d6a`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByText("Reach small business owners in Manila.", {
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:365:11

[apps/web/e2e/booked-services.spec.ts:365](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:365); SHA-256 `6d8be854d6255105032ec44393b85f23737aad81c1a95eac3b5102f36d64c0c9`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByText("A responsive five-page website with a contact form.", {
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:370:11

[apps/web/e2e/booked-services.spec.ts:370](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:370); SHA-256 `f54739a28ebbaba4ddcdb86206c941731d7d77b2e0ee828c06172dcad0330763`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      drawer.getByText("Please use our existing brand guide.", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:373:11

[apps/web/e2e/booked-services.spec.ts:373](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:373); SHA-256 `79c5d6e2feb961619da90047419e0f18ba73b235f6cd27f935eadc796ec540fe`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(drawer.getByText("Submitted", { exact: true })).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:374:5

[apps/web/e2e/booked-services.spec.ts:374](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:374); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/booked-services.spec.ts:385:11

[apps/web/e2e/booked-services.spec.ts:385](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:385); SHA-256 `097b752fb32dbb8f46dbecce76a49d5b5a77fbc7d318f42aecf1a39205a2e176`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(drawer).toHaveCount(0)
```

### apps/web/e2e/booked-services.spec.ts:386:11

[apps/web/e2e/booked-services.spec.ts:386](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:386); SHA-256 `349d18edbde0766770a54c8b8f9f1e9d7d56b52649eb0c098f3b71b74f346b1c`.

Direct callback owners: PW-024, PW-026.

All possible owners, including helper/route/hook candidates: PW-024, PW-026.

```ts
expect(opener).toBeFocused()
```

### apps/web/e2e/booked-services.spec.ts:399:9

[apps/web/e2e/booked-services.spec.ts:399](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:399); SHA-256 `c57361405d7e7c040cfe8128bdfed4bceb7c2621236fcd973d5cdf01229ffee9`.

Direct callback owners: PW-027.

All possible owners, including helper/route/hook candidates: PW-027.

```ts
expect(
    drawer.getByRole("heading", { name: "Website Development", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:403:9

[apps/web/e2e/booked-services.spec.ts:403](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:403); SHA-256 `097b752fb32dbb8f46dbecce76a49d5b5a77fbc7d318f42aecf1a39205a2e176`.

Direct callback owners: PW-027.

All possible owners, including helper/route/hook candidates: PW-027.

```ts
expect(drawer).toHaveCount(0)
```

### apps/web/e2e/booked-services.spec.ts:404:9

[apps/web/e2e/booked-services.spec.ts:404](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:404); SHA-256 `83727d97c4f18ca0f5bc4601b67752c9df7983a95a76ea2a46c491691c85e374`.

Direct callback owners: PW-027.

All possible owners, including helper/route/hook candidates: PW-027.

```ts
expect(
    page.getByRole("heading", { name: "Booked Services", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:415:9

[apps/web/e2e/booked-services.spec.ts:415](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:415); SHA-256 `559c7535d507cd77b0d338e0c3861357eb8212f93d730e163616887ee60025d4`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(main.getByRole("alert")).toContainText(
    "Booked services are temporarily unavailable.",
  )
```

### apps/web/e2e/booked-services.spec.ts:420:9

[apps/web/e2e/booked-services.spec.ts:420](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:420); SHA-256 `93d2e8e1f5e73090b4741c1d597255815fda940c47f8eadd0fc34f4d9a99473f`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(
    main.getByRole("table").getByRole("button", { name: /^View booking / }),
  ).toHaveCount(10)
```

### apps/web/e2e/booked-services.spec.ts:431:9

[apps/web/e2e/booked-services.spec.ts:431](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:431); SHA-256 `caf3ca15e6241e5342d79ac80ddc72bb472483a6f4988440be0794d6c32839fb`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(drawer.getByRole("alert")).toContainText(
    "Booking details are temporarily unavailable.",
  )
```

### apps/web/e2e/booked-services.spec.ts:436:9

[apps/web/e2e/booked-services.spec.ts:436](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:436); SHA-256 `c57361405d7e7c040cfe8128bdfed4bceb7c2621236fcd973d5cdf01229ffee9`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(
    drawer.getByRole("heading", { name: "Website Development", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:439:3

[apps/web/e2e/booked-services.spec.ts:439](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:439); SHA-256 `5d6bc64c1c550b9f6fee71d4d1356ff7a8738ea4ff9214783443c1558b31fe2b`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(state.listQueries.length).toBeGreaterThanOrEqual(2)
```

### apps/web/e2e/booked-services.spec.ts:440:3

[apps/web/e2e/booked-services.spec.ts:440](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:440); SHA-256 `afcc9cecd97ced64a304d081585bef33ec951b971f17f268aa924435e7e851ab`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(state.detailIds.length).toBeGreaterThanOrEqual(2)
```

### apps/web/e2e/booked-services.spec.ts:441:3

[apps/web/e2e/booked-services.spec.ts:441](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:441); SHA-256 `5a56222d1e4c5746949f381eece6be416ca2c09ba598ed355dfe95d65101af10`.

Direct callback owners: PW-028.

All possible owners, including helper/route/hook candidates: PW-028.

```ts
expect(state.detailIds.every((id) => id === "request-1")).toBe(true)
```

### apps/web/e2e/booked-services.spec.ts:456:11

[apps/web/e2e/booked-services.spec.ts:456](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:456); SHA-256 `2d8c85498a77a09d7c1c6d7ed371e1cb03e55079a97caaf5cf149434dd70c13e`.

Direct callback owners: PW-029.

All possible owners, including helper/route/hook candidates: PW-029.

```ts
expect(main.getByRole("table").getByRole("status")).toContainText(
      "Loading booked services",
    )
```

### apps/web/e2e/booked-services.spec.ts:460:11

[apps/web/e2e/booked-services.spec.ts:460](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:460); SHA-256 `f88f5da4dcab925cb1d814105331a60a23bf558645d97a48524b8208c3b7cdce`.

Direct callback owners: PW-029.

All possible owners, including helper/route/hook candidates: PW-029.

```ts
expect(
      main.getByRole("table").getByRole("button", { name: /^View booking / }),
    ).toHaveCount(10)
```

### apps/web/e2e/booked-services.spec.ts:471:11

[apps/web/e2e/booked-services.spec.ts:471](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:471); SHA-256 `56a3aa3fe7c52867bde90027f3ebe32e1e8ff88e482ac91f47c342cb2c60fa11`.

Direct callback owners: PW-029.

All possible owners, including helper/route/hook candidates: PW-029.

```ts
expect(drawer.getByRole("status")).toContainText(
      "Loading booking details",
    )
```

### apps/web/e2e/booked-services.spec.ts:475:11

[apps/web/e2e/booked-services.spec.ts:475](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:475); SHA-256 `6f6af4e88f73605831fabc112b4cf2dd5dcf98850670cd470ad1b540a4763950`.

Direct callback owners: PW-029.

All possible owners, including helper/route/hook candidates: PW-029.

```ts
expect(
      drawer.getByRole("heading", { name: "Website Development", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:491:11

[apps/web/e2e/booked-services.spec.ts:491](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:491); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-030.

All possible owners, including helper/route/hook candidates: PW-030.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/booked-services.spec.ts:492:11

[apps/web/e2e/booked-services.spec.ts:492](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:492); SHA-256 `1d98f140861142f6f87c7a20cca0cd3e91733ba01116993434fe2003bf05ca36`.

Direct callback owners: PW-030.

All possible owners, including helper/route/hook candidates: PW-030.

```ts
expect(
      page.getByRole("main", { name: "Dashboard", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/booked-services.spec.ts:495:11

[apps/web/e2e/booked-services.spec.ts:495](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:495); SHA-256 `5ad010a5b16f73292687cc14860f29cef3b32ec866c6094d62e2a4a3e0600fc1`.

Direct callback owners: PW-030.

All possible owners, including helper/route/hook candidates: PW-030.

```ts
expect(
      page
        .getByRole("navigation", { name: "Main menu", exact: true })
        .getByRole("link", { name: "Booked Services", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/booked-services.spec.ts:500:5

[apps/web/e2e/booked-services.spec.ts:500](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:500); SHA-256 `524d884c33b3063eba1ece37eac97550bcaeff8f00ab5ec07acb0ce1a29286e4`.

Direct callback owners: PW-030.

All possible owners, including helper/route/hook candidates: PW-030.

```ts
expect(state.listQueries).toHaveLength(0)
```

### apps/web/e2e/booked-services.spec.ts:501:5

[apps/web/e2e/booked-services.spec.ts:501](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:501); SHA-256 `e3c106137a2c254baa4cf8f2a030f11cb5be2d4849fc12411a751dff199b5f20`.

Direct callback owners: PW-030.

All possible owners, including helper/route/hook candidates: PW-030.

```ts
expect(state.detailIds).toHaveLength(0)
```

## apps/web/e2e/client-mutations.spec.ts

### apps/web/e2e/client-mutations.spec.ts:60:7

[apps/web/e2e/client-mutations.spec.ts:60](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:60); SHA-256 `7e4dcab5a5de645c082ebc9503bf68e32a2698cc00059be46c7167dc3def8263`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(["PATCH", "DELETE"]).not.toContain(request.method())
```

### apps/web/e2e/client-mutations.spec.ts:69:11

[apps/web/e2e/client-mutations.spec.ts:69](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:69); SHA-256 `7f01d4117dbbba176c866663de4184f7bebe162442038478eb8496b766b11d04`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.getByLabel("Full Name")).toBeFocused()
```

### apps/web/e2e/client-mutations.spec.ts:70:11

[apps/web/e2e/client-mutations.spec.ts:70](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:70); SHA-256 `1295c474d17a4fbc8c824ebc7b872e938c38665c7e1177ef77bf75585ac1b74b`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.locator("[data-field-error]")).toHaveCount(4)
```

### apps/web/e2e/client-mutations.spec.ts:71:5

[apps/web/e2e/client-mutations.spec.ts:71](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:71); SHA-256 `18cd0f935901062226f25905a4631ae84bd516ae88f698129890ae442f3605f5`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(rejectSave).toBe(true)
```

### apps/web/e2e/client-mutations.spec.ts:77:11

[apps/web/e2e/client-mutations.spec.ts:77](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:77); SHA-256 `1735a24669cec6bd8c7801d5577cd7ccf0e10c96080a75683bfe142a65cd0ae7`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.getByLabel("Email Address")).toBeFocused()
```

### apps/web/e2e/client-mutations.spec.ts:78:11

[apps/web/e2e/client-mutations.spec.ts:78](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:78); SHA-256 `041ac114bededb61b6114cad8b23feb110334a38877e1d2aed7212cc288a60a7`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(
      dialog.getByLabel("Email Address"),
    ).toHaveAccessibleDescription("Enter a valid email address.")
```

### apps/web/e2e/client-mutations.spec.ts:81:11

[apps/web/e2e/client-mutations.spec.ts:81](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:81); SHA-256 `5bc025e884863241334111edaaaac2e8e0617124054a2542059c0ce148b6e84f`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.locator("[data-field-error]")).toHaveCount(1)
```

### apps/web/e2e/client-mutations.spec.ts:82:5

[apps/web/e2e/client-mutations.spec.ts:82](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:82); SHA-256 `18cd0f935901062226f25905a4631ae84bd516ae88f698129890ae442f3605f5`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(rejectSave).toBe(true)
```

### apps/web/e2e/client-mutations.spec.ts:87:11

[apps/web/e2e/client-mutations.spec.ts:87](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:87); SHA-256 `98e9d5897cd457ae383d7e0455708535e4b559326637c77cb30e4afddfbd5a79`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.locator("[data-field-error]")).toHaveCount(0)
```

### apps/web/e2e/client-mutations.spec.ts:89:11

[apps/web/e2e/client-mutations.spec.ts:89](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:89); SHA-256 `a70435dbe6b70d47c18ee6897d2cb30d43638b16ffed86d1d4b75d26c3cbbe57`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.getByRole("alert")).toContainText("already exists")
```

### apps/web/e2e/client-mutations.spec.ts:90:11

[apps/web/e2e/client-mutations.spec.ts:90](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:90); SHA-256 `3a5a6d72ad550f5286e056ab960c94f639d81309c04fb0e595985f67118c5e9c`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.getByLabel("Full Name")).toHaveValue("Test Client")
```

### apps/web/e2e/client-mutations.spec.ts:93:11

[apps/web/e2e/client-mutations.spec.ts:93](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:93); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/client-mutations.spec.ts:100:11

[apps/web/e2e/client-mutations.spec.ts:100](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:100); SHA-256 `f91b9b24356c20a56fa517cf2ac430e0849a0a4ffc912357d6d30c4bda2db2fe`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(
      dialog.getByText("new@example.com", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/client-mutations.spec.ts:103:11

[apps/web/e2e/client-mutations.spec.ts:103](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:103); SHA-256 `148ba958e7bd5b86725bdce675b52529951ce49d93f69ba477a44f02d95b1cf7`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.getByText("09171234567", { exact: true })).toBeVisible()
```

### apps/web/e2e/client-mutations.spec.ts:104:11

[apps/web/e2e/client-mutations.spec.ts:104](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:104); SHA-256 `62f47812916a979abb390452a53dd0068ed07e11efcae73307e25a4dd27bff40`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog.getByLabel("Initial Password")).toHaveCount(0)
```

### apps/web/e2e/client-mutations.spec.ts:106:11

[apps/web/e2e/client-mutations.spec.ts:106](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:106); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/client-mutations.spec.ts:107:11

[apps/web/e2e/client-mutations.spec.ts:107](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:107); SHA-256 `22735e72077672431635da569730b12df58ba0140c04950493274c2e6fb4efc2`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(view).toBeFocused()
```

### apps/web/e2e/client-mutations.spec.ts:108:11

[apps/web/e2e/client-mutations.spec.ts:108](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:108); SHA-256 `8e4232010d544435f4d02d6087eb97c293e0e164e9527c1fc080ed4a65fde779`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(
      page.getByRole("button", { name: "Edit Test Client", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/client-mutations.spec.ts:111:11

[apps/web/e2e/client-mutations.spec.ts:111](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:111); SHA-256 `cd298279a451d40f3cdfd092013f1428aa9267fb8df53c088eedd63e96941e92`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(
      page.getByRole("button", {
        name: "More actions for Test Client",
        exact: true,
      }),
    ).toHaveCount(0)
```

### apps/web/e2e/client-mutations.spec.ts:117:5

[apps/web/e2e/client-mutations.spec.ts:117](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:117); SHA-256 `e1f576b083c4728eb3852fc01e419ef3e9a8e0e45439e80ec455de104b7a3fe3`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(clients).toHaveLength(1)
```

### apps/web/e2e/client-mutations.spec.ts:118:5

[apps/web/e2e/client-mutations.spec.ts:118](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:118); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-031, PW-032.

All possible owners, including helper/route/hook candidates: PW-031, PW-032.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

## apps/web/e2e/client-service-requests.spec.ts

### apps/web/e2e/client-service-requests.spec.ts:116:11

[apps/web/e2e/client-service-requests.spec.ts:116](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:116); SHA-256 `9226b1b80e0d7a1cebe8dc669b99c98e6785ec5acf96209121e36372d9318eda`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(
      page.getByRole("heading", { name: "Booked Requests", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:119:11

[apps/web/e2e/client-service-requests.spec.ts:119](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:119); SHA-256 `3426e0492f59369f093f40c13f118ab46b9c0d724bc050a3d5eb38f8f731c4ab`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(page.getByText("Showing 1–10 of 12")).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:121:11

[apps/web/e2e/client-service-requests.spec.ts:121](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:121); SHA-256 `55380580957edc11ecbbc2b13c26b6019a9e7e2bb18911ddace75b50c370d737`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(page.getByText("Showing 11–12 of 12")).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:128:11

[apps/web/e2e/client-service-requests.spec.ts:128](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:128); SHA-256 `a652d96adaa1edaba41905864b675636eb5611a917e5e216150a77abe05535ca`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(page.getByText("Showing 1–6 of 6")).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:132:11

[apps/web/e2e/client-service-requests.spec.ts:132](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:132); SHA-256 `e96fdfc3b69cd760b08b8ea279a03fb3a529f6de874946792d8a1518bbee973e`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:141:11

[apps/web/e2e/client-service-requests.spec.ts:141](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:141); SHA-256 `069504dbc367422d8f50cc968fac4fa7725942f49b34c36ebadbb3192cf71778`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(dialog).toContainText("Reach more customers")
```

### apps/web/e2e/client-service-requests.spec.ts:142:11

[apps/web/e2e/client-service-requests.spec.ts:142](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:142); SHA-256 `e749b7d3edabd19f298fed0d0df3416ef699e260556f9c247dde9315d59f3485`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(dialog).toContainText("Alex Santos")
```

### apps/web/e2e/client-service-requests.spec.ts:143:11

[apps/web/e2e/client-service-requests.spec.ts:143](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:143); SHA-256 `c0d29a5b2e76ad8d3e5b2fa0d499f1e60e2b010c675bca878380da1816c5bafb`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(dialog).toContainText(
      "Department Manager makes the final assignment",
    )
```

### apps/web/e2e/client-service-requests.spec.ts:146:11

[apps/web/e2e/client-service-requests.spec.ts:146](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:146); SHA-256 `c2f3b47dbfc744a6d40957701b4faca343a754d68369ffa576629ad62d5dc73b`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(dialog).toContainText("25,000.00")
```

### apps/web/e2e/client-service-requests.spec.ts:151:11

[apps/web/e2e/client-service-requests.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:151); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/client-service-requests.spec.ts:159:11

[apps/web/e2e/client-service-requests.spec.ts:159](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:159); SHA-256 `9049adeec19550d75381f23a47dcf58d92e95dc2109b83215f9f23e76c7ed839`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect.poll(() => calls.at(-1)).toContain("sortOrder=asc")
```

### apps/web/e2e/client-service-requests.spec.ts:160:11

[apps/web/e2e/client-service-requests.spec.ts:160](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:160); SHA-256 `c8ed0b8723537dca9f6ea411cc630c0575ee33bb6abd86b96bdb1cfcb33e6f07`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(
      page
        .getByRole("row")
        .or(page.getByRole("listitem"))
        .filter({ hasText: "SR-20261030-12" })
        .getByRole("button", {
          name: "View request: Web Development",
          exact: true,
        }),
    ).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:173:5

[apps/web/e2e/client-service-requests.spec.ts:173](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:173); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/client-service-requests.spec.ts:181:11

[apps/web/e2e/client-service-requests.spec.ts:181](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:181); SHA-256 `c0b4d847672a84e6f7953978c1926d728941bfd7c83b1ebd7e8e8e4c6b29fe32`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(
      page.getByRole("heading", { name: "No matching requests" }),
    ).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:184:11

[apps/web/e2e/client-service-requests.spec.ts:184](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:184); SHA-256 `468aeaa995bb17421e10a4f0b248c5fa8ca3b2ab18a30d9df2acbd12f3d3ebe4`.

Direct callback owners: PW-033, PW-034.

All possible owners, including helper/route/hook candidates: PW-033, PW-034.

```ts
expect(
      page.getByRole("link", { name: "New Service Request", exact: true }),
    ).toHaveAttribute("href", "/services")
```

### apps/web/e2e/client-service-requests.spec.ts:218:9

[apps/web/e2e/client-service-requests.spec.ts:218](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:218); SHA-256 `e77998e34c959a9aed7ca3d1da03ab9b45efe1ad2c39ed30df94a3422aee711c`.

Direct callback owners: PW-035.

All possible owners, including helper/route/hook candidates: PW-035.

```ts
expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Requests temporarily unavailable",
  )
```

### apps/web/e2e/client-service-requests.spec.ts:223:9

[apps/web/e2e/client-service-requests.spec.ts:223](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:223); SHA-256 `bb129f073df3545cc323e38430ccb0efdf3d5151df91374e71095a037f1bdd7f`.

Direct callback owners: PW-035.

All possible owners, including helper/route/hook candidates: PW-035.

```ts
expect(
    page.getByRole("heading", { name: "No service requests yet" }),
  ).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:226:9

[apps/web/e2e/client-service-requests.spec.ts:226](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:226); SHA-256 `20d7e198c86667f2cfc7f6fcfb4f57111a963ddd791c47ad3b356317d3a0a5a6`.

Direct callback owners: PW-035.

All possible owners, including helper/route/hook candidates: PW-035.

```ts
expect(
    page.getByRole("link", { name: "Browse services", exact: true }),
  ).toHaveAttribute("href", "/services")
```

### apps/web/e2e/client-service-requests.spec.ts:264:9

[apps/web/e2e/client-service-requests.spec.ts:264](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:264); SHA-256 `cf4dcfc532a4ff0d98de43905d8c2b1f86a4f43208b7c361468ef78d03b282b6`.

Direct callback owners: PW-036.

All possible owners, including helper/route/hook candidates: PW-036.

```ts
expect(
    page.getByRole("heading", { name: "Booked Requests", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:276:11

[apps/web/e2e/client-service-requests.spec.ts:276](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:276); SHA-256 `35f56a33616a33c4d8a0ca156cb96cecc3e7676d715b79637993805c1f4f8ed3`.

Direct callback owners: PW-036.

All possible owners, including helper/route/hook candidates: PW-036.

```ts
expect(table.getByText(label, { exact: true })).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:289:11

[apps/web/e2e/client-service-requests.spec.ts:289](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:289); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-037, PW-038, PW-039.

All possible owners, including helper/route/hook candidates: PW-037, PW-038, PW-039.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/client-service-requests.spec.ts:290:11

[apps/web/e2e/client-service-requests.spec.ts:290](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:290); SHA-256 `621da38573e07196cda72175815385a8849a2e00eca8e148a46764a8689c1214`.

Direct callback owners: PW-037, PW-038, PW-039.

All possible owners, including helper/route/hook candidates: PW-037, PW-038, PW-039.

```ts
expect(
      page.getByRole("link", { name: "Booked Requests", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/client-service-requests.spec.ts:293:5

[apps/web/e2e/client-service-requests.spec.ts:293](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:293); SHA-256 `f1590f25702b569016bb09795d557d902c8ee3fb89850a452d8dfd92042c0dcd`.

Direct callback owners: PW-037, PW-038, PW-039.

All possible owners, including helper/route/hook candidates: PW-037, PW-038, PW-039.

```ts
expect(calls).toEqual([])
```

### apps/web/e2e/client-service-requests.spec.ts:322:9

[apps/web/e2e/client-service-requests.spec.ts:322](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:322); SHA-256 `e96fdfc3b69cd760b08b8ea279a03fb3a529f6de874946792d8a1518bbee973e`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:325:3

[apps/web/e2e/client-service-requests.spec.ts:325](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:325); SHA-256 `58abe5976eb7b818f371bf1cebb9d79c06ff40b7ef2baa11114a48494c0ad1ed`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(reads).toBe(initialReads)
```

### apps/web/e2e/client-service-requests.spec.ts:334:9

[apps/web/e2e/client-service-requests.spec.ts:334](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:334); SHA-256 `888ed2936e79edc34978b3ed5bd469ab381de19b34ac76c2baff6bf2e3263e4f`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(page.getByRole("dialog")).toContainText("Under review")
```

### apps/web/e2e/client-service-requests.spec.ts:339:9

[apps/web/e2e/client-service-requests.spec.ts:339](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:339); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/client-service-requests.spec.ts:340:9

[apps/web/e2e/client-service-requests.spec.ts:340](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:340); SHA-256 `dc608dcfdb5a3b80650d43dbc9c5c9c18ba0d127b8e0cfd109d0e98ae149877f`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(
    page
      .getByRole("region", { name: "Request history" })
      .getByText("Under review", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible()
```

### apps/web/e2e/client-service-requests.spec.ts:346:9

[apps/web/e2e/client-service-requests.spec.ts:346](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:346); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/client-service-requests.spec.ts:349:9

[apps/web/e2e/client-service-requests.spec.ts:349](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:349); SHA-256 `d02b44ec9c8f9e6741ac6a93899fab306a2308e7cf8ca9dd009fe61a68accc3f`.

Direct callback owners: PW-040.

All possible owners, including helper/route/hook candidates: PW-040.

```ts
expect(
    page.getByText("Closed", { exact: true }).filter({ visible: true }).last(),
  ).toBeVisible()
```

## apps/web/e2e/client.spec.ts

### apps/web/e2e/client.spec.ts:70:15

[apps/web/e2e/client.spec.ts:70](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:70); SHA-256 `6301d634705883a7e9221dfb62eaff2e29abe9ab012e14cf0345ef1d7fd55bf3`.

Direct callback owners: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

All possible owners, including helper/route/hook candidates: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

```ts
expect(cards).toHaveCount(Math.max(1, packageCount))
```

### apps/web/e2e/client.spec.ts:82:11

[apps/web/e2e/client.spec.ts:82](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:82); SHA-256 `2dd00442f4e4e0bf5a362465568a2f8d3a7f57a7bce69fef76408274c6d3b428`.

Direct callback owners: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

All possible owners, including helper/route/hook candidates: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

```ts
expect(card.width).toBeGreaterThanOrEqual(280)
```

### apps/web/e2e/client.spec.ts:83:11

[apps/web/e2e/client.spec.ts:83](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:83); SHA-256 `6f3de24b3735d7717c68f308f066ca275c51499ff890f6fc89b3e647e1587b4a`.

Direct callback owners: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

All possible owners, including helper/route/hook candidates: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

```ts
expect(card.width).toBeLessThanOrEqual(331)
```

### apps/web/e2e/client.spec.ts:84:11

[apps/web/e2e/client.spec.ts:84](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:84); SHA-256 `ec4e9c32623bfa203ce15ba31e1378e58cbdecc2130c0dcabb0a50e00cb43b56`.

Direct callback owners: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

All possible owners, including helper/route/hook candidates: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

```ts
expect(card.height).toBeLessThan(500)
```

### apps/web/e2e/client.spec.ts:85:11

[apps/web/e2e/client.spec.ts:85](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:85); SHA-256 `a4fc0e5bde03a2aaed1cf35877adbd9abade43c4ba124d2e4ad0e48f48b1a88e`.

Direct callback owners: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

All possible owners, including helper/route/hook candidates: PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049.

```ts
expect(card.overflow).toBe(false)
```

### apps/web/e2e/client.spec.ts:194:13

[apps/web/e2e/client.spec.ts:194](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:194); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:195:13

[apps/web/e2e/client.spec.ts:195](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:195); SHA-256 `bbbe70f50995ab994d436a52d3b5361bf78600f1c8c1ea96d142d61421ec38b3`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("heading", {
          name: "Social Media Management",
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:201:13

[apps/web/e2e/client.spec.ts:201](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:201); SHA-256 `fae8e6c8a72f042a3d127cf555585f0e29ccf7eeb47e71f713a5ff772de06c3e`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "2",
      )
```

### apps/web/e2e/client.spec.ts:205:13

[apps/web/e2e/client.spec.ts:205](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:205); SHA-256 `54df75535634f9b8fb31197d4d1d46275350256bc43c2aca8e98303cdcebf4b4`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByText("Recommended", { exact: true })).toBeVisible()
```

### apps/web/e2e/client.spec.ts:206:13

[apps/web/e2e/client.spec.ts:206](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:206); SHA-256 `86f10f0d3dfaed575ee3761fc1a8234eafb8193695f2bcff9972f24a8dda2c4e`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText("Retired package", { exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:209:13

[apps/web/e2e/client.spec.ts:209](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:209); SHA-256 `ad1a6d3e6ce333509f09f498cc71593487cf273c7160854e2c6e894cd9785521`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByText(/99,999/)).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:210:13

[apps/web/e2e/client.spec.ts:210](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:210); SHA-256 `c8c6ffd8722faf9cab40d85cf04326491b251676e949677aa41e5eb0f48bea91`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", { name: "Continue", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/client.spec.ts:216:13

[apps/web/e2e/client.spec.ts:216](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:216); SHA-256 `817d81c30496aa7370b2a52e5ca9e8e61c67b896f0060bc86996f128dc41246d`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(packageCards).toHaveCount(5)
```

### apps/web/e2e/client.spec.ts:236:7

[apps/web/e2e/client.spec.ts:236](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:236); SHA-256 `87e301fe67c0e0a1d55d5f42c081c684cee956925a214f815c284992ae654f07`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        Math.abs(
          firstRow[0].left +
            firstRow.at(-1)!.right -
            (lastRow[0].left + lastRow.at(-1)!.right),
        ),
      ).toBeLessThan(2)
```

### apps/web/e2e/client.spec.ts:244:9

[apps/web/e2e/client.spec.ts:244](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:244); SHA-256 `62a04b9448a6c9c5def586c62720bb335a6a9107f85d1a6887bf1c3be923b2f0`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(Math.abs(card.width - cardLayout[0].width)).toBeLessThan(1)
```

### apps/web/e2e/client.spec.ts:247:9

[apps/web/e2e/client.spec.ts:247](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:247); SHA-256 `62f268af5f776f9a8984559f1d14fe4bcf85d5fc19688c691442c6d547c73720`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(Math.abs(card.buttonTop - firstRow[0].buttonTop)).toBeLessThan(1)
```

### apps/web/e2e/client.spec.ts:252:13

[apps/web/e2e/client.spec.ts:252](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:252); SHA-256 `c477902609346ca0f7a8cc65cc6c9e69f83d9fc116dbbbeeaab405f97538eb41`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toContainText("Starter")
```

### apps/web/e2e/client.spec.ts:253:13

[apps/web/e2e/client.spec.ts:253](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:253); SHA-256 `faf08b828fb807584c2b8fcc5c58150afe8c81ccda772be12c3f9df2d5344b02`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toContainText("₱2,500")
```

### apps/web/e2e/client.spec.ts:254:13

[apps/web/e2e/client.spec.ts:254](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:254); SHA-256 `2c69fb6c1c26f5505692c2ed2408b6b2b279b229df07d4c88673f81b47c94e92`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toContainText("/ month")
```

### apps/web/e2e/client.spec.ts:262:13

[apps/web/e2e/client.spec.ts:262](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:262); SHA-256 `454bf55720a0980aa3ec41724ae49dfee7f8bc19e65d19b3dc81e12a14c74d1a`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", { name: "Select Starter", exact: true }),
      ).toHaveAttribute("aria-pressed", "true")
```

### apps/web/e2e/client.spec.ts:268:13

[apps/web/e2e/client.spec.ts:268](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:268); SHA-256 `4b1de5b9b926404a081e68664f8818f03cd3696b25136415571cd74ad0315bc7`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toContainText(
        "Contact for pricing",
      )
```

### apps/web/e2e/client.spec.ts:271:13

[apps/web/e2e/client.spec.ts:271](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:271); SHA-256 `e7945820c326c392048f326cd25d7e7c0d12256a62078b4daaa60f3d476a1411`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText("Consultation required", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:275:13

[apps/web/e2e/client.spec.ts:275](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:275); SHA-256 `7e46980e4592042dd5ef5d2a8e6cf729248ede997b59cff2b45b7a3095ec65e9`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("heading", {
          name: "Project Requirements",
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:281:13

[apps/web/e2e/client.spec.ts:281](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:281); SHA-256 `e1731fe1859b9cb1f2c25a38d415ce42ffd77ce15942112b582b92248b66b6ae`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "3",
      )
```

### apps/web/e2e/client.spec.ts:285:13

[apps/web/e2e/client.spec.ts:285](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:285); SHA-256 `f8838320bea4025f7c52250263ff0854e056217249045c339d6bbc73cb6183f8`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("complementary", { name: "Project context" }),
      ).toContainText("Custom plan")
```

### apps/web/e2e/client.spec.ts:288:13

[apps/web/e2e/client.spec.ts:288](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:288); SHA-256 `8631cbe91b6d278deef311a5562ebfabb3e16b5117bfa6ec50396e25a79e8948`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText("Brand guidelines", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:298:13

[apps/web/e2e/client.spec.ts:298](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:298); SHA-256 `b0e1b8863eceecd043abe774ce01063d12b4af0f2575370c518fbd479862ab84`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("main").getByRole("alert")).toHaveCount(3)
```

### apps/web/e2e/client.spec.ts:300:13

[apps/web/e2e/client.spec.ts:300](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:300); SHA-256 `e1731fe1859b9cb1f2c25a38d415ce42ffd77ce15942112b582b92248b66b6ae`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "3",
      )
```

### apps/web/e2e/client.spec.ts:304:13

[apps/web/e2e/client.spec.ts:304](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:304); SHA-256 `b0e1b8863eceecd043abe774ce01063d12b4af0f2575370c518fbd479862ab84`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("main").getByRole("alert")).toHaveCount(3)
```

### apps/web/e2e/client.spec.ts:305:13

[apps/web/e2e/client.spec.ts:305](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:305); SHA-256 `b8bffeb198d61fe22531e2e8af1ff0db3cca86e78b9f875a11c9e2b7fbb42973`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("textbox", { name: "Project goals", exact: true }),
      ).toBeFocused()
```

### apps/web/e2e/client.spec.ts:322:13

[apps/web/e2e/client.spec.ts:322](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:322); SHA-256 `d155b5e19be9ef1279844d1625455de7e7669e5f97daa11fde0bab0348da7014`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("main").getByRole("alert")).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:326:13

[apps/web/e2e/client.spec.ts:326](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:326); SHA-256 `7b4300d4bbdf1018aab438a3b7def847198fa96db0b9632d75fbf4506aacdeee`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toContainText(
        "Saved in this browser tab.",
      )
```

### apps/web/e2e/client.spec.ts:330:13

[apps/web/e2e/client.spec.ts:330](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:330); SHA-256 `dc145d7df709d28d9dc06ae179f65a8086ac6ce22bb5f0f2f107a28121eb9aa3`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", { name: "Select Custom plan", exact: true }),
      ).toHaveAttribute("aria-pressed", "true")
```

### apps/web/e2e/client.spec.ts:337:13

[apps/web/e2e/client.spec.ts:337](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:337); SHA-256 `7fbbe44800058d2b170a484f44652df4d96fae44e5578690cd82bdc4f5962b4a`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("textbox", { name: "Project goals", exact: true }),
      ).toHaveValue("Increase awareness and generate qualified leads.")
```

### apps/web/e2e/client.spec.ts:340:13

[apps/web/e2e/client.spec.ts:340](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:340); SHA-256 `9c73077c43b11e78dd553ea8aca8cb65d4440d17570ab909b7118230c564bbd0`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("textbox", {
          name: "Project requirements",
          exact: true,
        }),
      ).toHaveValue("Create a content calendar and 12 posts each month.")
```

### apps/web/e2e/client.spec.ts:346:13

[apps/web/e2e/client.spec.ts:346](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:346); SHA-256 `e191b347206d499b9465b6c9e19091e8400544940155d331421cc1a5f1d0180a`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("textbox", { name: "Expected timeline", exact: true }),
      ).toHaveValue("Launch within six weeks, with a flexible start date.")
```

### apps/web/e2e/client.spec.ts:349:13

[apps/web/e2e/client.spec.ts:349](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:349); SHA-256 `494a24788c4e3435e3f7e9ec62b63beefa28c558b797b9d6e99a84f564100372`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("textbox", { name: /^Additional details/ }),
      ).toHaveValue(
        "Our audience is small business owners. Follow our existing brand colors.",
      )
```

### apps/web/e2e/client.spec.ts:354:13

[apps/web/e2e/client.spec.ts:354](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:354); SHA-256 `c83d0c17f14d044f33db8144031f4e1abcf14e5074b4b04e7a0408802c9c30b8`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("complementary", { name: "Project context" }),
      ).toContainText("Starter")
```

### apps/web/e2e/client.spec.ts:360:13

[apps/web/e2e/client.spec.ts:360](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:360); SHA-256 `c38d794b0ed7b22d97f0a768e33db28a9ebdb649e472fc8afe01253f5ad0c827`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:393:13

[apps/web/e2e/client.spec.ts:393](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:393); SHA-256 `02fac3b050c630a4b5862bed90ff5667a0ccf63e82492de7c178183bf6dcd747`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "4",
      )
```

### apps/web/e2e/client.spec.ts:397:13

[apps/web/e2e/client.spec.ts:397](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:397); SHA-256 `6c2df178d74640928090843406b06db63dc2aa64a58572af441198dc6ff4ea23`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("heading", {
          name: "Who would you like to work with?",
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:403:13

[apps/web/e2e/client.spec.ts:403](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:403); SHA-256 `ce70c2fc25ade8d3f4396b27f8b074252b76a67ab8307466a10d5a1c8987befb`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("main").getByRole("alert")).toContainText(
        "couldn’t load",
      )
```

### apps/web/e2e/client.spec.ts:411:13

[apps/web/e2e/client.spec.ts:411](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:411); SHA-256 `a13f79c4e7ce69731a1df409b0f28144b346b98bb5aeba8bf511cdf644161832`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("complementary", {
          name: "Specialist selection summary",
        }),
      ).toContainText("Alex Santos")
```

### apps/web/e2e/client.spec.ts:416:13

[apps/web/e2e/client.spec.ts:416](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:416); SHA-256 `57be1748eeaa35f958db75662262b3e15c122353dd563fa74a8eae3fdbfe8186`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText("Assignment is confirmed during review", {
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:425:13

[apps/web/e2e/client.spec.ts:425](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:425); SHA-256 `31eba9430084a53b2b38138f139c30f63dd4f39e4e9ef4aa2010530493a95cc4`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("textbox", { name: "Project goals", exact: true }),
      ).toHaveValue("Grow our online community.")
```

### apps/web/e2e/client.spec.ts:429:13

[apps/web/e2e/client.spec.ts:429](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:429); SHA-256 `c405bcd68e4990fad2c869dc5da8712b9ef4aab69d7ab723628daa8bb03b8342`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("radio", { name: "Prefer Alex Santos", exact: true }),
      ).toBeChecked()
```

### apps/web/e2e/client.spec.ts:435:13

[apps/web/e2e/client.spec.ts:435](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:435); SHA-256 `c38d794b0ed7b22d97f0a768e33db28a9ebdb649e472fc8afe01253f5ad0c827`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("status")).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:441:13

[apps/web/e2e/client.spec.ts:441](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:441); SHA-256 `38c1092c193a4ee0e197be6638a41d377f2de86c6659e14c1a9e263414d83200`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText(/No specialists are currently listed/),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:444:13

[apps/web/e2e/client.spec.ts:444](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:444); SHA-256 `f08c5a9cfaf16a1821d39343e2092af9225e524915a4bc6792fb81e15278d910`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", {
          name: "Submit service request for review",
          exact: true,
        }),
      ).toBeDisabled()
```

### apps/web/e2e/client.spec.ts:457:7

[apps/web/e2e/client.spec.ts:457](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:457); SHA-256 `ffae9077477b477a163789b1aba00015e8ddc857ae6862f9f303992909163ea6`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
```

### apps/web/e2e/client.spec.ts:465:13

[apps/web/e2e/client.spec.ts:465](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:465); SHA-256 `d43124fd1874d8afdf6f97be50496b0c6118da21520b4c3fcacc2e3b4926ba24`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("radio", { name: "Prefer Alex Santos", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:501:13

[apps/web/e2e/client.spec.ts:501](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:501); SHA-256 `4ed08431dece1d9ca6573116b85817347a6f5fa4225c95c191d89ac74aace8b5`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuemax",
        "4",
      )
```

### apps/web/e2e/client.spec.ts:505:13

[apps/web/e2e/client.spec.ts:505](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:505); SHA-256 `b57a31b9613ed60a237a571f476dd92dabbb06e2ec37421fe2303a0f185b7915`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByText("Step 4 of 4", { exact: true })).toBeVisible()
```

### apps/web/e2e/client.spec.ts:512:13

[apps/web/e2e/client.spec.ts:512](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:512); SHA-256 `33981caa87898a0d73773f960da8fddfc45cf04f4d5da2e885d0891524270576`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Submission temporarily unavailable",
      )
```

### apps/web/e2e/client.spec.ts:521:13

[apps/web/e2e/client.spec.ts:521](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:521); SHA-256 `a53daedfd1fe7c7d31b3cb4c27a365d985e9942881ed64024a874f6c55b073b7`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect.poll(() => submissions.length).toBe(2)
```

### apps/web/e2e/client.spec.ts:522:13

[apps/web/e2e/client.spec.ts:522](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:522); SHA-256 `b7722876b04bfceee55f7bd159bc57a69d94d28d49a4a4a8e3e9e99d9b011ff8`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", { name: "Submitting request…", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/client.spec.ts:525:13

[apps/web/e2e/client.spec.ts:525](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:525); SHA-256 `5f5067cc459131e805c1241872f8d2dbbc01225a3003d2acfcd128931aea65ca`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", { name: "Back to project requirements" }),
      ).toBeDisabled()
```

### apps/web/e2e/client.spec.ts:528:13

[apps/web/e2e/client.spec.ts:528](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:528); SHA-256 `e62f027fdb3f84d9d04c7b8ac37acdd9eac4e017adb3d3da9f42ad3b751d56bc`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("radio", { name: "Prefer Alex Santos", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/client.spec.ts:531:7

[apps/web/e2e/client.spec.ts:531](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:531); SHA-256 `bb062b259c7de9493cfd7b48b2010ee031823beee30b6c774af4dadf1349366c`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(submissions[0].submissionKey).toBe(submissions[1].submissionKey)
```

### apps/web/e2e/client.spec.ts:532:7

[apps/web/e2e/client.spec.ts:532](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:532); SHA-256 `23bb585d5a679f3ce1d72f6ef1074cada2aee089ffd92806c0b894ac35a6e36b`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(submissions[1]).toMatchObject({
        serviceId: "social-service",
        packageId: "starter",
        preferredSpecialistId: width === 1280 ? "specialist-1" : null,
        goals: "Grow our online community.",
        requirements: "Create a content calendar and 12 posts each month.",
        expectedTimeline:
          "Launch within six weeks, with a flexible start date.",
        additionalDetails:
          "Our audience is small business owners. Follow our existing brand colors.",
      })
```

### apps/web/e2e/client.spec.ts:543:7

[apps/web/e2e/client.spec.ts:543](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:543); SHA-256 `f559707f7eb420625d5c75b61123a4716d57805aa004d61ed2e83eafc5d1756c`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(submissions[1]).not.toHaveProperty("clientId")
```

### apps/web/e2e/client.spec.ts:545:13

[apps/web/e2e/client.spec.ts:545](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:545); SHA-256 `a17ff3381624d8c0f932734288a41ab8777faeb6b602adda8335f3305cfcf81a`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("heading", {
          name: "Service request submitted for review",
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:551:13

[apps/web/e2e/client.spec.ts:551](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:551); SHA-256 `5d1aa1d5ced05200cf4e1fe48adadd8f0c7c3e1ca07086702b26f839766e05cd`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByText("request-123", { exact: true })).toBeVisible()
```

### apps/web/e2e/client.spec.ts:552:13

[apps/web/e2e/client.spec.ts:552](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:552); SHA-256 `88d5bba7210d0ffe81e21c210cd3e335dd9a4509220f1f44ecac0d0127802dc2`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText("Pending review", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:555:13

[apps/web/e2e/client.spec.ts:555](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:555); SHA-256 `496541daec967b0d24bd56e0e0ae52341282eff0640f0ef2c19c112e470b8177`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByText("Request not submitted", { exact: true }),
      ).toBeHidden()
```

### apps/web/e2e/client.spec.ts:558:13

[apps/web/e2e/client.spec.ts:558](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:558); SHA-256 `443d6edc8aafe95f787a3318d8f5245df9f7b1bb10d29f41619b67c808f9e051`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", {
          name: "Submit service request for review",
          exact: true,
        }),
      ).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:570:13

[apps/web/e2e/client.spec.ts:570](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:570); SHA-256 `3c045cd12907847f565bd55e2dd1d0eb759117eeccbc00b641792b828e702f28`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "1",
      )
```

### apps/web/e2e/client.spec.ts:574:13

[apps/web/e2e/client.spec.ts:574](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:574); SHA-256 `9211698fe2cf1489adbcd1829b83caf3b1053452ed8d914c3e6ba1f173c85f16`.

Direct callback owners: PW-050, PW-051.

All possible owners, including helper/route/hook candidates: PW-050, PW-051.

```ts
expect(
        page.getByRole("button", { name: "Explore Social Media Management" }),
      ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:621:11

[apps/web/e2e/client.spec.ts:621](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:621); SHA-256 `44c949908b18e28822a6ac9d4213d2ee8c934b4650540f1bea07d27acb7b8513`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Catalog temporarily unavailable",
    )
```

### apps/web/e2e/client.spec.ts:625:11

[apps/web/e2e/client.spec.ts:625](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:625); SHA-256 `a0003275f3d724400c1ab5dd7b537a22425333ff58a2268662d08cbb1cc6da72`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(8)
```

### apps/web/e2e/client.spec.ts:629:11

[apps/web/e2e/client.spec.ts:629](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:629); SHA-256 `3e7c59c1fc67c0a690678d6d91bbb475e20f72bcb42feeff9248f95c90b1197e`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(2)
```

### apps/web/e2e/client.spec.ts:636:11

[apps/web/e2e/client.spec.ts:636](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:636); SHA-256 `13cbdfb76975261bf9c25b37483ecab9a94fab7e191b292de3edc50d8cdeec8a`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", { name: "Page 1", exact: true }),
    ).toHaveAttribute("aria-current", "page")
```

### apps/web/e2e/client.spec.ts:639:11

[apps/web/e2e/client.spec.ts:639](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:639); SHA-256 `a0003275f3d724400c1ab5dd7b537a22425333ff58a2268662d08cbb1cc6da72`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(8)
```

### apps/web/e2e/client.spec.ts:645:11

[apps/web/e2e/client.spec.ts:645](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:645); SHA-256 `2c1534c5f6c220c0473bbf992595da979cf046116ddf14c7960891e8287e1548`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByText("No services found", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/client.spec.ts:648:11

[apps/web/e2e/client.spec.ts:648](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:648); SHA-256 `2e666e4bef5bd1b8eb7e274183fef76a760a9e991c57f234f29de7a51e3bf6e6`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(0)
```

### apps/web/e2e/client.spec.ts:654:11

[apps/web/e2e/client.spec.ts:654](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:654); SHA-256 `ee4eba15144be250bc76bb3c67a849306345b85e8ccfa7d495639b4289c77350`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(1)
```

### apps/web/e2e/client.spec.ts:657:11

[apps/web/e2e/client.spec.ts:657](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:657); SHA-256 `9cccc7207123f1fb06fbd354c3e08d7c52952b51cb8f5d9bb334bc04ce413357`.

Direct callback owners: PW-052.

All possible owners, including helper/route/hook candidates: PW-052.

```ts
expect(
      page.getByRole("button", {
        name: "Explore Catalog Service 3",
        exact: true,
      }),
    ).toBeVisible()
```

## apps/web/e2e/clients.spec.ts

### apps/web/e2e/clients.spec.ts:25:15

[apps/web/e2e/clients.spec.ts:25](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:25); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/clients.spec.ts:26:9

[apps/web/e2e/clients.spec.ts:26](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:26); SHA-256 `bfe72696486336fd893dc834f7a2489223e920e32c8618e77a8f7fab1dfc7bec`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(requests).toEqual([])
```

### apps/web/e2e/clients.spec.ts:29:13

[apps/web/e2e/clients.spec.ts:29](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:29); SHA-256 `0c84f94e4bb3f5649cb6081716c3e9e04941f89a71a5dd9b9335f83c238d7d01`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(
        page.getByRole("heading", { name: "Client Management" }),
      ).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:33:13

[apps/web/e2e/clients.spec.ts:33](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:33); SHA-256 `fae784eb8e840ebb761517cb97c603d3fab401a8a2f0bd2e7ac954d1abc34f53`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(page.getByRole("dialog")).toContainText("target@example.com")
```

### apps/web/e2e/clients.spec.ts:37:13

[apps/web/e2e/clients.spec.ts:37](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:37); SHA-256 `f9a3e2adad4912cedde41254995148c332f1d7e5b63e620ebbf833dca6cfeff1`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(
        page.getByText("No service requests are linked to this client yet."),
      ).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:41:13

[apps/web/e2e/clients.spec.ts:41](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:41); SHA-256 `e59ca0224b34df69605ab4ed5e40ea8d6975693df98352f0e0ce5b85e6fb2df5`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(
        page.getByText("No projects are linked to this client yet."),
      ).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:48:13

[apps/web/e2e/clients.spec.ts:48](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:48); SHA-256 `79707f7485df0f4bab78aad75629e288f7630e5f0f5410df1531280c9be27bdf`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(
        page
          .getByRole("status")
          .filter({ hasText: /No results for.*missing-client.*found/ }),
      ).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:54:13

[apps/web/e2e/clients.spec.ts:54](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:54); SHA-256 `a9698ccd0724e7a4947275d6d35aa3b4de1b29fc9c190b323dbb5ef65cccb362`.

Direct callback owners: PW-053, PW-054, PW-055, PW-056.

All possible owners, including helper/route/hook candidates: PW-053, PW-054, PW-055, PW-056.

```ts
expect(page.getByText("Target User", { exact: true })).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:70:9

[apps/web/e2e/clients.spec.ts:70](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:70); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/clients.spec.ts:71:9

[apps/web/e2e/clients.spec.ts:71](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:71); SHA-256 `91f518592c25987b81b529ab60dbda3d5d1564df27c05e83181509d3d4f93b97`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(route.request().headers().authorization).toBe(
          "Bearer test-session",
        )
```

### apps/web/e2e/clients.spec.ts:121:13

[apps/web/e2e/clients.spec.ts:121](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:121); SHA-256 `7a8f58797d2e43011f1966e2b06fbcda1c32ba83d2eaeed853add2a878430d97`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Submission temporarily unavailable" }),
      ).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:126:13

[apps/web/e2e/clients.spec.ts:126](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:126); SHA-256 `90e5667f0a319ae8cb2248ca260051ecd58f3ab8b8a4f110a2b50dbc1468d783`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(
        page.getByRole("heading", {
          name: "Service request submitted for review",
          exact: true,
        }),
      ).toHaveCount(0)
```

### apps/web/e2e/clients.spec.ts:132:13

[apps/web/e2e/clients.spec.ts:132](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:132); SHA-256 `9c144b505151a81913b3e2bb0a784f956979490c96247b4649d66d8dc34d063f`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(submit).toBeEnabled()
```

### apps/web/e2e/clients.spec.ts:133:7

[apps/web/e2e/clients.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:133); SHA-256 `1367a1cf3834ea891c3cfc0544d3a97a06ea17ce2a52a25f6e630bd34adccf9c`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(submissions).toHaveLength(1)
```

### apps/web/e2e/clients.spec.ts:135:13

[apps/web/e2e/clients.spec.ts:135](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:135); SHA-256 `5a2f6ad23ac711d0e4fb95ad916364790ea62aa2ff4b7c144e45ad2bf903366b`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(
        page.getByRole("heading", {
          name: "Service request submitted for review",
          exact: true,
        }),
      ).toBeFocused()
```

### apps/web/e2e/clients.spec.ts:141:7

[apps/web/e2e/clients.spec.ts:141](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:141); SHA-256 `ac8252713b8cd74f6ecc253271248052e8e2317be08548c4c96487488f0e5994`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(submissions).toHaveLength(2)
```

### apps/web/e2e/clients.spec.ts:142:7

[apps/web/e2e/clients.spec.ts:142](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:142); SHA-256 `56635a2598155f1f2acb2e1770272323cf39924ca14a2fd0f24cbfbcee89bd83`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(submissions[1]).toEqual(submissions[0])
```

### apps/web/e2e/clients.spec.ts:143:7

[apps/web/e2e/clients.spec.ts:143](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:143); SHA-256 `29e247ef57e8e4e76716a56562e65d05d7918776bf4abcd0d4ed07d3e94d41ac`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(submissions[0].submissionKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
```

### apps/web/e2e/clients.spec.ts:146:7

[apps/web/e2e/clients.spec.ts:146](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:146); SHA-256 `9d3d92516d52108901cec6a9d2171270e8a083d636c2fd4abfc6ef1f3ddfd3d0`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(submissions[0]).not.toHaveProperty("clientId")
```

### apps/web/e2e/clients.spec.ts:147:13

[apps/web/e2e/clients.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:147); SHA-256 `c2e21ede02b11ae5e5466c301e34656a9758c8369a55afb28a0561fab3caa2bd`.

Direct callback owners: PW-057, PW-060.

All possible owners, including helper/route/hook candidates: PW-057, PW-060.

```ts
expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Submission temporarily unavailable" }),
      ).toHaveCount(0)
```

### apps/web/e2e/clients.spec.ts:165:9

[apps/web/e2e/clients.spec.ts:165](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:165); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/clients.spec.ts:193:15

[apps/web/e2e/clients.spec.ts:193](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:193); SHA-256 `4f5bf1f9cd52a753fe581df241a880416f3b9b2442d054003fbc9f7caa584f2b`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(select).toHaveAttribute("aria-pressed", "false")
```

### apps/web/e2e/clients.spec.ts:204:17

[apps/web/e2e/clients.spec.ts:204](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:204); SHA-256 `1b3bbbc3573d1f6a72ea672e83227d0e0cf6f405e46ece5ab36c0abaf0e8b56a`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(input).toHaveValue("")
```

### apps/web/e2e/clients.spec.ts:210:15

[apps/web/e2e/clients.spec.ts:210](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:210); SHA-256 `7cebc4e5d1d3b62c1f8cd7403c8138c89cdf944fba2a13848837a60032edab90`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(
          page.getByText(/No specialists are currently listed/),
        ).toBeVisible()
```

### apps/web/e2e/clients.spec.ts:219:15

[apps/web/e2e/clients.spec.ts:219](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:219); SHA-256 `d8231892f36ab270ab42a2a9963a0758f820e6375606da85b2cc9b1cad800ea8`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(
          page.getByRole("heading", {
            name: "Service request submitted for review",
            exact: true,
          }),
        ).toBeFocused()
```

### apps/web/e2e/clients.spec.ts:225:15

[apps/web/e2e/clients.spec.ts:225](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:225); SHA-256 `42b80fa9cb0c70b7a949d0801cf2050424f82b7a334ac8b10f9e48198c05c6bf`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(
          page.getByRole("link", {
            name: "View my booked requests",
            exact: true,
          }),
        ).toHaveAttribute("href", "/service-requests")
```

### apps/web/e2e/clients.spec.ts:231:9

[apps/web/e2e/clients.spec.ts:231](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:231); SHA-256 `bceff4464e890600317e81a77c606e14c4a37e63389796005749f0d7b0526341`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(submissions).toHaveLength(attempt)
```

### apps/web/e2e/clients.spec.ts:232:9

[apps/web/e2e/clients.spec.ts:232](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:232); SHA-256 `6cbd2533773100ba25ba8dfbe4b97e888f74ac8f0011aad8bdeb81106ce54cc1`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(submissions[attempt - 1]).toMatchObject({
          serviceId: "service-1",
          packageId: null,
          preferredSpecialistId: null,
          goals: `Project goals for request ${attempt}`,
          additionalDetails: "",
        })
```

### apps/web/e2e/clients.spec.ts:239:9

[apps/web/e2e/clients.spec.ts:239](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:239); SHA-256 `ae4ae4d51c85abefefa6b2f51d91be1e5bb2f232aa60927b2ae933eee8705b8a`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(submissions[attempt - 1]).not.toHaveProperty("clientId")
```

### apps/web/e2e/clients.spec.ts:244:7

[apps/web/e2e/clients.spec.ts:244](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:244); SHA-256 `54403febf2734900063d7c25189fe9937fc4c14dc54d46b7145d91f7f90ceaba`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(submissions[0].submissionKey).toEqual(expect.any(String))
```

### apps/web/e2e/clients.spec.ts:245:7

[apps/web/e2e/clients.spec.ts:245](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:245); SHA-256 `7f7492f0545eb8e19112e003ab7df2229071a733b8f1f8f09c2b6b82a23856a7`.

Direct callback owners: PW-058, PW-061.

All possible owners, including helper/route/hook candidates: PW-058, PW-061.

```ts
expect(submissions[1].submissionKey).not.toBe(
        submissions[0].submissionKey,
      )
```

### apps/web/e2e/clients.spec.ts:266:13

[apps/web/e2e/clients.spec.ts:266](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:266); SHA-256 `9c557d713bfcd0b7a04f40c09d84466a358b7b5bf82e3fb7dd5fbbffb807245e`.

Direct callback owners: PW-059, PW-062.

All possible owners, including helper/route/hook candidates: PW-059, PW-062.

```ts
expect(dialog.getByLabel("Full Name")).toHaveValue("Draft Client")
```

### apps/web/e2e/clients.spec.ts:267:13

[apps/web/e2e/clients.spec.ts:267](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:267); SHA-256 `be38371b878235f96d71b9d5c5b8f3449ea80a41cc778179944380f4272caa35`.

Direct callback owners: PW-059, PW-062.

All possible owners, including helper/route/hook candidates: PW-059, PW-062.

```ts
expect(dialog.getByLabel("Email Address")).toHaveValue(
        "draft@example.com",
      )
```

### apps/web/e2e/clients.spec.ts:271:13

[apps/web/e2e/clients.spec.ts:271](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:271); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-059, PW-062.

All possible owners, including helper/route/hook candidates: PW-059, PW-062.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/clients.spec.ts:272:13

[apps/web/e2e/clients.spec.ts:272](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:272); SHA-256 `349d18edbde0766770a54c8b8f9f1e9d7d56b52649eb0c098f3b71b74f346b1c`.

Direct callback owners: PW-059, PW-062.

All possible owners, including helper/route/hook candidates: PW-059, PW-062.

```ts
expect(opener).toBeFocused()
```

### apps/web/e2e/clients.spec.ts:274:13

[apps/web/e2e/clients.spec.ts:274](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:274); SHA-256 `c1edc537180c1e647009fc9abb6e0208e88ac70fd1197c3dd4b8014db2dd0ede`.

Direct callback owners: PW-059, PW-062.

All possible owners, including helper/route/hook candidates: PW-059, PW-062.

```ts
expect(dialog.getByLabel("Full Name")).toHaveValue("")
```

## apps/web/e2e/departments.spec.ts

### apps/web/e2e/departments.spec.ts:21:11

[apps/web/e2e/departments.spec.ts:21](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:21); SHA-256 `d5531fefad4ec3698cf6886ee9884b6e041f5aa25e7e3bfe2561b1197e3510a5`.

Direct callback owners: PW-063.

All possible owners, including helper/route/hook candidates: PW-063.

```ts
expect(
      page.getByRole("menuitem", { name: "Deactivate account", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:24:11

[apps/web/e2e/departments.spec.ts:24](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:24); SHA-256 `1ea024e6834674a10d6a2fc382678e0f99cafffe370c71d02f9650d705138216`.

Direct callback owners: PW-063.

All possible owners, including helper/route/hook candidates: PW-063.

```ts
expect(
      page.getByRole("menuitem", { name: "Change status", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/departments.spec.ts:27:11

[apps/web/e2e/departments.spec.ts:27](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:27); SHA-256 `48b7c6327276c5fb28bb673dbcceb2f1e7510d580f34823efee1463996d34daa`.

Direct callback owners: PW-063.

All possible owners, including helper/route/hook candidates: PW-063.

```ts
expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/departments.spec.ts:31:11

[apps/web/e2e/departments.spec.ts:31](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:31); SHA-256 `fc0cf9a4b09f725686d5638f93679863cb098b999a74547852c854c9db26889c`.

Direct callback owners: PW-063.

All possible owners, including helper/route/hook candidates: PW-063.

```ts
expect(
      page.getByRole("button", { name: "More actions for Alex Employee" }),
    ).toBeFocused()
```

### apps/web/e2e/departments.spec.ts:93:11

[apps/web/e2e/departments.spec.ts:93](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:93); SHA-256 `8632a89f1c907c114bcc9dc104f240451f1a22f22da388c34f5b14f315dfdb35`.

Direct callback owners: PW-064.

All possible owners, including helper/route/hook candidates: PW-064.

```ts
expect(
      page.getByRole("button", { name: "Save team", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/departments.spec.ts:106:5

[apps/web/e2e/departments.spec.ts:106](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:106); SHA-256 `f73a6529b115405f4293161da54ae6ff051aa5067be91d6ac6528a4dbd9cd37f`.

Direct callback owners: PW-064.

All possible owners, including helper/route/hook candidates: PW-064.

```ts
expect((await request).postDataJSON()).toMatchObject({
      name: "Restricted Team",
      memberIds: ["employee-1"],
    })
```

### apps/web/e2e/departments.spec.ts:110:11

[apps/web/e2e/departments.spec.ts:110](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:110); SHA-256 `a840263e8a3a7dd7efa0dff4dcb2b6b86c2a3195b2c70569e05517740483b729`.

Direct callback owners: PW-064.

All possible owners, including helper/route/hook candidates: PW-064.

```ts
expect(page.getByText("Team permission revoked")).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:111:11

[apps/web/e2e/departments.spec.ts:111](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:111); SHA-256 `f9075761d0a73247080f000ca2a6a76c863baecf89d58fa3876e5f3a2035023e`.

Direct callback owners: PW-064.

All possible owners, including helper/route/hook candidates: PW-064.

```ts
expect(
      page.getByText("No teams created in this department yet."),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:122:11

[apps/web/e2e/departments.spec.ts:122](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:122); SHA-256 `f1056d8007595dacb55ba699f98add2b6275fae0d62257c02ebe5b6587c39570`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("heading", { name: "Department Management" }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:125:11

[apps/web/e2e/departments.spec.ts:125](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:125); SHA-256 `986f52b19cc9f396d3dbd7990c8713119475c70296904c5d1ae60d4ca1c8f997`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("button", { name: "Engineering", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:133:11

[apps/web/e2e/departments.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:133); SHA-256 `7576f2d6a6954fd44017e7b9b7e386549a6f7b2b9858f407b4f7f30648fc3910`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("heading", { name: "Create Department" }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:139:11

[apps/web/e2e/departments.spec.ts:139](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:139); SHA-256 `ba8d748f22c90d34236118655de0048ada2d65241f1014f15a9aa4fb0d77b03c`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("radiogroup", { name: "Department color" }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:153:11

[apps/web/e2e/departments.spec.ts:153](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:153); SHA-256 `fd4efb2f55d75be5fffc5102e555ca882444e71549c7904c4547eb4a72e726ca`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(page.getByText("Customer Support")).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:154:5

[apps/web/e2e/departments.spec.ts:154](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:154); SHA-256 `e15d686f7e228cdec6d45f9c83ffcd0d8040ce44e20d267a4c849d68a48f9def`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect((await createdDepartment).postDataJSON()).toMatchObject({
      name: "Customer Support",
      color: "green",
    })
```

### apps/web/e2e/departments.spec.ts:162:11

[apps/web/e2e/departments.spec.ts:162](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:162); SHA-256 `766668619bbb4615d74b19d9472caf1033c22cee55541f7b04cc66aaf1e910fa`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("heading", { name: "Edit Department" }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:165:11

[apps/web/e2e/departments.spec.ts:165](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:165); SHA-256 `c6e992ef50e828890b42903e09180ce555b279dff51bcaa72f831f99f0b8e283`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("radio", { name: "Green", exact: true }),
    ).toBeChecked()
```

### apps/web/e2e/departments.spec.ts:174:11

[apps/web/e2e/departments.spec.ts:174](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:174); SHA-256 `b4167f2541e00cbc465d752fa7aad0d2e422c374fc2543134028731f03b94df3`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(page.getByText("Client Success")).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:182:11

[apps/web/e2e/departments.spec.ts:182](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:182); SHA-256 `3294dfb29c816ffb1f2640e9019cb4c62b9e961f067639d22e81b8d865abf706`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("heading", { name: "Members & teams" }),
    ).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:186:11

[apps/web/e2e/departments.spec.ts:186](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:186); SHA-256 `6f6315fe370042e3c4e9a3669f1b7c13d6c364776a591ef1eac075dbee079ed0`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(
      page.getByRole("heading", { name: "Members & teams" }),
    ).toHaveCount(0)
```

### apps/web/e2e/departments.spec.ts:196:11

[apps/web/e2e/departments.spec.ts:196](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:196); SHA-256 `b1f728ad623ba779ccfd53fa85296041764c64a0d58bec984c504b80b0f047dd`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(page.getByText("Delete department?")).toBeVisible()
```

### apps/web/e2e/departments.spec.ts:201:11

[apps/web/e2e/departments.spec.ts:201](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:201); SHA-256 `01974914058b2bcec4a3ec0dbeb6072240d9e1e99a9a8779a9197da00b6dd326`.

Direct callback owners: PW-065.

All possible owners, including helper/route/hook candidates: PW-065.

```ts
expect(page.getByText("Client Success")).toHaveCount(0)
```

## apps/web/e2e/dropdown-positioning.spec.ts

### apps/web/e2e/dropdown-positioning.spec.ts:14:9

[apps/web/e2e/dropdown-positioning.spec.ts:14](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:14); SHA-256 `8b877c79174481ecbe31c7e7115f19cccce4a7772fc09903ba2f07ddb20ce1de`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-066, PW-067, PW-068, PW-069, PW-070.

```ts
expect(popup).toBeVisible()
```

### apps/web/e2e/dropdown-positioning.spec.ts:15:9

[apps/web/e2e/dropdown-positioning.spec.ts:15](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:15); SHA-256 `ceeacd3a073c8136ef64210ca4907438ee23f5d5ec8050bb2ea509a5da599378`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-066, PW-067, PW-068, PW-069, PW-070.

```ts
expect
    .poll(async () => {
      return popup.evaluate((element, triggerBox) => {
        if (!triggerBox) return false
        const box = element.getBoundingClientRect()
        const visible = window.visualViewport
        const left = visible?.offsetLeft ?? 0
        const top = visible?.offsetTop ?? 0
        const right = left + (visible?.width ?? window.innerWidth)
        const bottom = top + (visible?.height ?? window.innerHeight)
        const separateFromTrigger =
          box.bottom <= triggerBox.y - 1 ||
          box.top >= triggerBox.y + triggerBox.height + 1
        const center = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        )
        return (
          box.left >= left + 7 &&
          box.right <= right - 7 &&
          box.top >= top + 7 &&
          box.bottom <= bottom - 7 &&
          separateFromTrigger &&
          Boolean(center && element.contains(center))
        )
      }, anchor)
    })
    .toBe(true)
```

### apps/web/e2e/dropdown-positioning.spec.ts:74:13

[apps/web/e2e/dropdown-positioning.spec.ts:74](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:74); SHA-256 `a53b3eee9faff2109355a39917fe516f0d72d115e22cb342230ad796c399caab`.

Direct callback owners: PW-066, PW-068.

All possible owners, including helper/route/hook candidates: PW-066, PW-068.

```ts
expect(trigger).toHaveText("Recurring")
```

### apps/web/e2e/dropdown-positioning.spec.ts:78:13

[apps/web/e2e/dropdown-positioning.spec.ts:78](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:78); SHA-256 `30b72b05c8aeed63a8749f61cb3e85242aec413f475e013f7398096aacd2f5a2`.

Direct callback owners: PW-066, PW-068.

All possible owners, including helper/route/hook candidates: PW-066, PW-068.

```ts
expect(interval).toHaveText("Monthly")
```

### apps/web/e2e/dropdown-positioning.spec.ts:98:13

[apps/web/e2e/dropdown-positioning.spec.ts:98](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:98); SHA-256 `59f9eec5a56ba81d3b2cadc1d2191b8ff8fa453c3119519aa1d26919da8dd3f5`.

Direct callback owners: PW-067, PW-069.

All possible owners, including helper/route/hook candidates: PW-067, PW-069.

```ts
expect(trigger).toContainText("Custom Department Name")
```

### apps/web/e2e/dropdown-positioning.spec.ts:127:11

[apps/web/e2e/dropdown-positioning.spec.ts:127](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:127); SHA-256 `28c2056a20db03e92b601a4b06b9e6c3e780dbfbfa0a3e64dca067be1d5fe1de`.

Direct callback owners: PW-070.

All possible owners, including helper/route/hook candidates: PW-070.

```ts
expect
      .poll(() =>
        menu.evaluate((element) => element.scrollHeight > element.clientHeight),
      )
      .toBe(true)
```

### apps/web/e2e/dropdown-positioning.spec.ts:136:11

[apps/web/e2e/dropdown-positioning.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:136); SHA-256 `e51adbb6b73a317f8333489471e88c45a5fccedb9ae1713f0b73c0500f3d0189`.

Direct callback owners: PW-070.

All possible owners, including helper/route/hook candidates: PW-070.

```ts
expect(
      menu.getByRole("menuitemradio", { name: "Department 18", exact: true }),
    ).toBeInViewport()
```

### apps/web/e2e/dropdown-positioning.spec.ts:140:11

[apps/web/e2e/dropdown-positioning.spec.ts:140](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:140); SHA-256 `43ed6c09bf7bfaf8e3e87a5f97a80e4a35c527dfd7f295aec4063cba0993ecef`.

Direct callback owners: PW-070.

All possible owners, including helper/route/hook candidates: PW-070.

```ts
expect(trigger).toContainText("Department 18")
```

## apps/web/e2e/employee-login.spec.ts

### apps/web/e2e/employee-login.spec.ts:91:9

[apps/web/e2e/employee-login.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:91); SHA-256 `26e1c1461d2e8be1130890bf822d725aaf6926b6c5c1214cdd7ece8798a5f885`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(input).not.toHaveProperty("password")
```

### apps/web/e2e/employee-login.spec.ts:113:9

[apps/web/e2e/employee-login.spec.ts:113](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:113); SHA-256 `26e1c1461d2e8be1130890bf822d725aaf6926b6c5c1214cdd7ece8798a5f885`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(input).not.toHaveProperty("password")
```

### apps/web/e2e/employee-login.spec.ts:115:11

[apps/web/e2e/employee-login.spec.ts:115](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:115); SHA-256 `a61d7a4cf603c9333785e8921928b818d345278eb398d2c5ac351c5b412a24d1`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(input.employeeId).toBe("EXP-000001")
```

### apps/web/e2e/employee-login.spec.ts:123:9

[apps/web/e2e/employee-login.spec.ts:123](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:123); SHA-256 `f55f9a8873f7d94997b3df6213bd83dcde58b66b7d62696b5db0772a666341e1`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(request.postDataJSON()).toEqual({ password: "ValidPassword1!" })
```

### apps/web/e2e/employee-login.spec.ts:128:9

[apps/web/e2e/employee-login.spec.ts:128](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:128); SHA-256 `731bcac44a6cfbe11e8b4cc0bfd6e31204e7f8730232d6bc58e57da4d57d02fc`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(request.method()).toBe("PATCH")
```

### apps/web/e2e/employee-login.spec.ts:162:11

[apps/web/e2e/employee-login.spec.ts:162](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:162); SHA-256 `b6a81ad582fb0e2710d730c10e7c066623f18101d28acc56ed2b39a40018409e`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog.getByLabel("Password", { exact: true })).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:163:11

[apps/web/e2e/employee-login.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:163); SHA-256 `a1698eb12c345cb05d716a54b473038ec9ccae08b05b76d8fffe95b8145aa913`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog.getByRole("heading")).toHaveText(
      "Complete employee details",
    )
```

### apps/web/e2e/employee-login.spec.ts:166:11

[apps/web/e2e/employee-login.spec.ts:166](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:166); SHA-256 `dcecd9bbcf311fdcf7a299f1b6cbd7c6c6c804e8ceb6feba7150e0a14d040a0f`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog.locator("#employee-id")).toHaveValue("")
```

### apps/web/e2e/employee-login.spec.ts:183:11

[apps/web/e2e/employee-login.spec.ts:183](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:183); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:199:11

[apps/web/e2e/employee-login.spec.ts:199](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:199); SHA-256 `48b7c6327276c5fb28bb673dbcceb2f1e7510d580f34823efee1463996d34daa`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/employee-login.spec.ts:207:11

[apps/web/e2e/employee-login.spec.ts:207](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:207); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:208:5

[apps/web/e2e/employee-login.spec.ts:208](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:208); SHA-256 `5c3f747e4df302829b8a6dd78975d6421679ca3d75ea66b06a0ce750f311d5b3`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(employee.status).toBe("ACTIVE")
```

### apps/web/e2e/employee-login.spec.ts:215:11

[apps/web/e2e/employee-login.spec.ts:215](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:215); SHA-256 `a503038ea0c04a8f3ede031edcc8d08279fb615543e984253a7ce8a5fd290bab`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeEnabled()
```

### apps/web/e2e/employee-login.spec.ts:223:11

[apps/web/e2e/employee-login.spec.ts:223](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:223); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:228:11

[apps/web/e2e/employee-login.spec.ts:228](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:228); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:230:11

[apps/web/e2e/employee-login.spec.ts:230](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:230); SHA-256 `af8fd35a3a9a9310b691973692583b49b960094c61c7cc6240dc44fecf13c9f9`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toContainText(
      "moves the deactivated account to Archive",
    )
```

### apps/web/e2e/employee-login.spec.ts:236:11

[apps/web/e2e/employee-login.spec.ts:236](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:236); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:237:11

[apps/web/e2e/employee-login.spec.ts:237](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:237); SHA-256 `9b3618b1061b66c4820729fb407e7550be914851c3de7f0be98901d645017622`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(
      page.getByRole("button", { name: "Edit Alex Employee", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:242:11

[apps/web/e2e/employee-login.spec.ts:242](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:242); SHA-256 `bd6128062fc2a5d76fa27d4cc166ef26d7dc91a6ef8ab2234762fa32c9bb748b`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toContainText("permanently deletes")
```

### apps/web/e2e/employee-login.spec.ts:246:11

[apps/web/e2e/employee-login.spec.ts:246](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:246); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/employee-login.spec.ts:247:11

[apps/web/e2e/employee-login.spec.ts:247](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:247); SHA-256 `e16b9f59e6f7d1f8f31072f7d3fb413599a8766f3b55115e2d20be424d982d5e`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(
      page.getByText("No archived accounts.", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/employee-login.spec.ts:250:5

[apps/web/e2e/employee-login.spec.ts:250](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:250); SHA-256 `92e24bdcc9114974b22c025a9058e89141886f4a5e4dcdf61e8c11c2b3ee57aa`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(loginStatusWrites).toEqual([false, true, false])
```

### apps/web/e2e/employee-login.spec.ts:251:5

[apps/web/e2e/employee-login.spec.ts:251](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:251); SHA-256 `7e01ce2a1030a9470d7b62a2d8ad293c0a91f3b1f401eb9d503db53782fd1e4e`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(accountArchived).toBe(true)
```

### apps/web/e2e/employee-login.spec.ts:252:5

[apps/web/e2e/employee-login.spec.ts:252](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:252); SHA-256 `931b8def601e0f85e957197dbb59a797f0bcbd4eca64ba7df3b29b925b22040a`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(accountDeleted).toBe(true)
```

### apps/web/e2e/employee-login.spec.ts:253:5

[apps/web/e2e/employee-login.spec.ts:253](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:253); SHA-256 `5c3f747e4df302829b8a6dd78975d6421679ca3d75ea66b06a0ce750f311d5b3`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(employee.status).toBe("ACTIVE")
```

### apps/web/e2e/employee-login.spec.ts:260:11

[apps/web/e2e/employee-login.spec.ts:260](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:260); SHA-256 `dcecd9bbcf311fdcf7a299f1b6cbd7c6c6c804e8ceb6feba7150e0a14d040a0f`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog.locator("#employee-id")).toHaveValue("")
```

### apps/web/e2e/employee-login.spec.ts:265:11

[apps/web/e2e/employee-login.spec.ts:265](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:265); SHA-256 `d22116f576451c1eee00f6b01fd22569f202a33e231620256cf1718bf55c0a1a`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(dialog.locator("#employee-password")).toHaveAttribute(
      "type",
      "text",
    )
```

### apps/web/e2e/employee-login.spec.ts:272:11

[apps/web/e2e/employee-login.spec.ts:272](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:272); SHA-256 `9add35a3df1fbbb8d99574b90526118139397dfc7f4a5770c88df9cafecbbac2`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(
      dialog.locator("#employee-password-confirmation"),
    ).toHaveAttribute("type", "text")
```

### apps/web/e2e/employee-login.spec.ts:275:5

[apps/web/e2e/employee-login.spec.ts:275](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:275); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-071, PW-072.

All possible owners, including helper/route/hook candidates: PW-071, PW-072.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

## apps/web/e2e/employees.spec.ts

### apps/web/e2e/employees.spec.ts:41:11

[apps/web/e2e/employees.spec.ts:41](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:41); SHA-256 `943f66d59e5a2d0601b5aeaf78646b687f2eeb4622ebce5aba4cc3d9c509a0ba`.

Direct callback owners: PW-073.

All possible owners, including helper/route/hook candidates: PW-073.

```ts
expect(
      page.getByText("Showing 1–2 of 2", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/employees.spec.ts:69:11

[apps/web/e2e/employees.spec.ts:69](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:69); SHA-256 `1824882db0ff26d214a81c59816e5d09bb7a1353d21ee8f50d8d8e2477c2d83e`.

Direct callback owners: PW-073.

All possible owners, including helper/route/hook candidates: PW-073.

```ts
expect(
      page.getByText("Showing 1–1 of 1", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/employees.spec.ts:83:5

[apps/web/e2e/employees.spec.ts:83](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:83); SHA-256 `b572e037fb6c6453ecaf91f5b98017b79ad91448226df35d2b8b324f00b09d8f`.

Direct callback owners: PW-073.

All possible owners, including helper/route/hook candidates: PW-073.

```ts
expect(
      samples.some(
        (sample) =>
          sample.moving && sample.summary.includes("Showing 1–2 of 2"),
      ),
    ).toBe(true)
```

### apps/web/e2e/employees.spec.ts:89:5

[apps/web/e2e/employees.spec.ts:89](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:89); SHA-256 `d6ecc27a2004af1dc07e0e92c03bd38ba441ace1e0338470fefac07f0d911368`.

Direct callback owners: PW-073.

All possible owners, including helper/route/hook candidates: PW-073.

```ts
expect(
      samples.some(
        (sample) =>
          sample.moving && sample.summary.includes("Showing 1–1 of 1"),
      ),
    ).toBe(false)
```

### apps/web/e2e/employees.spec.ts:95:11

[apps/web/e2e/employees.spec.ts:95](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:95); SHA-256 `f89e0871407b0e2463bc890fce5f7cf16f398a67d053d6338fa303b2b2137c47`.

Direct callback owners: PW-073.

All possible owners, including helper/route/hook candidates: PW-073.

```ts
expect(
      page.getByRole("row", { name: /Second Employee/ }),
    ).toBeVisible()
```

### apps/web/e2e/employees.spec.ts:137:13

[apps/web/e2e/employees.spec.ts:137](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:137); SHA-256 `8882a7b68aacd020f3618bfe90475bc5b60d6d72cad0e581c3dac99769d2d173`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(page.getByRole("menu")).toHaveCount(1)
```

### apps/web/e2e/employees.spec.ts:138:13

[apps/web/e2e/employees.spec.ts:138](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:138); SHA-256 `0050abd87bb3ded6a08dd2c73b162accf26d9c83baa309893543a793108a9ddc`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(second).toHaveAttribute("aria-expanded", "true")
```

### apps/web/e2e/employees.spec.ts:140:13

[apps/web/e2e/employees.spec.ts:140](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:140); SHA-256 `8882a7b68aacd020f3618bfe90475bc5b60d6d72cad0e581c3dac99769d2d173`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(page.getByRole("menu")).toHaveCount(1)
```

### apps/web/e2e/employees.spec.ts:141:13

[apps/web/e2e/employees.spec.ts:141](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:141); SHA-256 `f5a35ded2f6a655b5f98d0b097eef09c55cd6eca99cddb4d4e59686d97e44188`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(
        page.getByRole("menu", {
          name: "Actions for Alex Employee",
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/employees.spec.ts:147:13

[apps/web/e2e/employees.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:147); SHA-256 `79884173f47c0a8c4d52e1f9bacafdefc36ae142f690d35484179b894d2293ce`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(first).toHaveAttribute("aria-expanded", "true")
```

### apps/web/e2e/employees.spec.ts:148:13

[apps/web/e2e/employees.spec.ts:148](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:148); SHA-256 `76134288d2be4e1e9a05fb39396589d7c1c3e9ba6364200d14d339ea8139d330`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(second).toHaveAttribute("aria-expanded", "false")
```

### apps/web/e2e/employees.spec.ts:150:13

[apps/web/e2e/employees.spec.ts:150](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:150); SHA-256 `bff02d430a1f70024cd6ed31b8938b16b5477dea6f6072ca0a479ed21062f4d9`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(page.getByRole("menu")).toHaveCount(0)
```

### apps/web/e2e/employees.spec.ts:151:13

[apps/web/e2e/employees.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:151); SHA-256 `3cb0c20dbede95419b8b6d551983127a4ff4e200ac3c1b7e4d1164e56e3daa6b`.

Direct callback owners: PW-074, PW-075.

All possible owners, including helper/route/hook candidates: PW-074, PW-075.

```ts
expect(first).toBeFocused()
```

### apps/web/e2e/employees.spec.ts:161:11

[apps/web/e2e/employees.spec.ts:161](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:161); SHA-256 `8ecc52451de7d64bc99bb615e9b193fbab24de3eef82d319400f6bd1cdcc457a`.

Direct callback owners: PW-076.

All possible owners, including helper/route/hook candidates: PW-076.

```ts
expect(page.getByRole("dialog")).toContainText("EMP-001")
```

### apps/web/e2e/employees.spec.ts:162:11

[apps/web/e2e/employees.spec.ts:162](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:162); SHA-256 `ff1d38b289ef501a9f730156c005556e297f225df49515b7a63c5d0aaa8976bc`.

Direct callback owners: PW-076.

All possible owners, including helper/route/hook candidates: PW-076.

```ts
expect(page.getByRole("dialog")).toContainText(
      "alex.employee@example.com",
    )
```

### apps/web/e2e/employees.spec.ts:169:11

[apps/web/e2e/employees.spec.ts:169](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:169); SHA-256 `19b53af539653f6c61e2fa57ae9f04bcfce9a909fe02c5e7962644106fb5b356`.

Direct callback owners: PW-076.

All possible owners, including helper/route/hook candidates: PW-076.

```ts
expect(
      page.getByRole("menuitem", { name: "Deactivate account" }),
    ).toBeVisible()
```

### apps/web/e2e/employees.spec.ts:172:11

[apps/web/e2e/employees.spec.ts:172](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:172); SHA-256 `48b7c6327276c5fb28bb673dbcceb2f1e7510d580f34823efee1463996d34daa`.

Direct callback owners: PW-076.

All possible owners, including helper/route/hook candidates: PW-076.

```ts
expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/employees.spec.ts:177:11

[apps/web/e2e/employees.spec.ts:177](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:177); SHA-256 `c66dc1553179d1459a7e10be5d4ba59930e241bd6f2d0bccc3637dc5234ad851`.

Direct callback owners: PW-076.

All possible owners, including helper/route/hook candidates: PW-076.

```ts
expect(page.getByText("Alex Employee", { exact: true })).toBeVisible()
```

## apps/web/e2e/internal-conversations.spec.ts

### apps/web/e2e/internal-conversations.spec.ts:47:5

[apps/web/e2e/internal-conversations.spec.ts:47](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:47); SHA-256 `169370ba1b07ac39824c84e67c2a2f8a05e3f286b3c60d136b8dc9751790605e`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086.

```ts
expect(request.headers().authorization).toBe("Bearer test-session")
```

### apps/web/e2e/internal-conversations.spec.ts:49:7

[apps/web/e2e/internal-conversations.spec.ts:49](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:49); SHA-256 `1fb847d78cbfa4d384a107a6a99367c75b99a61bf2dd240b2a3a984062f86f6d`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086.

```ts
expect(request.method()).toBe("GET")
```

### apps/web/e2e/internal-conversations.spec.ts:72:7

[apps/web/e2e/internal-conversations.spec.ts:72](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:72); SHA-256 `870aa0a10a3add6efb9acb8faff1cfa56951ceb2ff9237688d8357534773f4b7`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086.

```ts
expect(body).toEqual({ recipientId: participant.id })
```

### apps/web/e2e/internal-conversations.spec.ts:91:7

[apps/web/e2e/internal-conversations.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:91); SHA-256 `731bcac44a6cfbe11e8b4cc0bfd6e31204e7f8730232d6bc58e57da4d57d02fc`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086.

```ts
expect(request.method()).toBe("PATCH")
```

### apps/web/e2e/internal-conversations.spec.ts:99:7

[apps/web/e2e/internal-conversations.spec.ts:99](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:99); SHA-256 `4ecfe00535b0388344dbdc86bf686b46bfb7336d5b1555ce4d52ef84274ed6df`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086.

```ts
expect(request.method()).toBe("POST")
```

### apps/web/e2e/internal-conversations.spec.ts:104:7

[apps/web/e2e/internal-conversations.spec.ts:104](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:104); SHA-256 `6130cb450683ba68dc4d723aadb55a34ed501d1c60fbb7b33f07d1c85e3bb117`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086.

```ts
expect(Object.keys(body).sort()).toEqual(["body", "clientMessageId"])
```

### apps/web/e2e/internal-conversations.spec.ts:153:13

[apps/web/e2e/internal-conversations.spec.ts:153](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:153); SHA-256 `b03d76fd40ba8ae69979982d010d81de69880eeb970f9ddd96c1b16ab32372eb`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(page).toHaveURL(/\/messages\?mode=internal&internal=chat-1$/)
```

### apps/web/e2e/internal-conversations.spec.ts:163:13

[apps/web/e2e/internal-conversations.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:163); SHA-256 `2a036f5fee90f1723771a38b3cd16f6cf8aa85d34d6a1b07e40a160aacade4e3`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(send).toBeDisabled()
```

### apps/web/e2e/internal-conversations.spec.ts:165:13

[apps/web/e2e/internal-conversations.spec.ts:165](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:165); SHA-256 `2a036f5fee90f1723771a38b3cd16f6cf8aa85d34d6a1b07e40a160aacade4e3`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(send).toBeDisabled()
```

### apps/web/e2e/internal-conversations.spec.ts:166:13

[apps/web/e2e/internal-conversations.spec.ts:166](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:166); SHA-256 `42d41b1439f51fcddff2c447a1abda94b0df57a8f18342f9dfa790bd9594af9a`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(input).toHaveAttribute("maxlength", "4000")
```

### apps/web/e2e/internal-conversations.spec.ts:171:13

[apps/web/e2e/internal-conversations.spec.ts:171](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:171); SHA-256 `830272633fb7c2ec0e634dfc471c57494abf5a606bb71fd6f8ba87223eaa1cb7`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        page.getByText("Connection interrupted. Retry your message.", {
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:176:13

[apps/web/e2e/internal-conversations.spec.ts:176](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:176); SHA-256 `ce3321b7b75cf23f4cadccd2d431b3d0c5919d310ae126da5b6bc86aec7f8a75`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(chat.getByRole("alert")).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:177:13

[apps/web/e2e/internal-conversations.spec.ts:177](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:177); SHA-256 `a1380bc1f2033f25f6fcdedc7aa4c18d7b0522e96518d9ab234a8be9d0e6382e`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(input).toHaveValue(body)
```

### apps/web/e2e/internal-conversations.spec.ts:179:13

[apps/web/e2e/internal-conversations.spec.ts:179](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:179); SHA-256 `1b3bbbc3573d1f6a72ea672e83227d0e0cf6f405e46ece5ab36c0abaf0e8b56a`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(input).toHaveValue("")
```

### apps/web/e2e/internal-conversations.spec.ts:180:13

[apps/web/e2e/internal-conversations.spec.ts:180](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:180); SHA-256 `5728aaf3b61dd258278416ce2e352a9266b52c4ad9cc16be3a47aaba854589f0`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(chat.getByRole("article")).toHaveCount(1)
```

### apps/web/e2e/internal-conversations.spec.ts:181:13

[apps/web/e2e/internal-conversations.spec.ts:181](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:181); SHA-256 `f1bf272e176e7fcb6f29ceb7c5c52f4863b3bda56541f17e044de37925fb5211`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(chat.getByRole("article")).toContainText(body)
```

### apps/web/e2e/internal-conversations.spec.ts:182:13

[apps/web/e2e/internal-conversations.spec.ts:182](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:182); SHA-256 `5d7909694dc7f07eca3d8d8c4dbe1ddfe5e05d932bc5649790cfdaa00c400cb4`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(chat.getByRole("article").locator("script")).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:183:7

[apps/web/e2e/internal-conversations.spec.ts:183](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:183); SHA-256 `2ddc969887368211cc8c5bc1bbd27cc8546f86d31691bc6bf8f075a331d587d0`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(state.sends).toHaveLength(2)
```

### apps/web/e2e/internal-conversations.spec.ts:184:7

[apps/web/e2e/internal-conversations.spec.ts:184](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:184); SHA-256 `9c3151c23690cf7d179653ec7a609619106c966d4fb1d176099b6254f9d1203c`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(state.sends[1]).toEqual(state.sends[0])
```

### apps/web/e2e/internal-conversations.spec.ts:185:7

[apps/web/e2e/internal-conversations.spec.ts:185](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:185); SHA-256 `ff59d42b0315bc94f93c910730f610ada8b789b61a2a96eaac817168e809fb66`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(state.sends[0].clientMessageId).toMatch(/^[0-9a-f-]{36}$/)
```

### apps/web/e2e/internal-conversations.spec.ts:186:7

[apps/web/e2e/internal-conversations.spec.ts:186](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:186); SHA-256 `77e4e16ad906e468bba18fa6f39dcb49a79225fb8d9eee3e3247df4b2f0bd069`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(state.messages).toHaveLength(1)
```

### apps/web/e2e/internal-conversations.spec.ts:188:13

[apps/web/e2e/internal-conversations.spec.ts:188](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:188); SHA-256 `5728aaf3b61dd258278416ce2e352a9266b52c4ad9cc16be3a47aaba854589f0`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(chat.getByRole("article")).toHaveCount(1)
```

### apps/web/e2e/internal-conversations.spec.ts:201:13

[apps/web/e2e/internal-conversations.spec.ts:201](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:201); SHA-256 `3267f906028bc9f0d2034250fc4af8d502b5f4aaa2c3a11dca33fc87bbcd8280`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        navigation.getByRole("link", { name: "Dani Colleague", exact: true }),
      ).toHaveCount(1)
```

### apps/web/e2e/internal-conversations.spec.ts:204:13

[apps/web/e2e/internal-conversations.spec.ts:204](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:204); SHA-256 `835dbf4aa7cec4ab5136e79cbd1385661c620737ab98b58b34446af80de5b287`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        navigation.getByRole("button", {
          name: "Dani Colleague Designer",
          exact: true,
        }),
      ).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:210:7

[apps/web/e2e/internal-conversations.spec.ts:210](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:210); SHA-256 `28a96a6a3493d65d6f4e5086845a788cb21115dafc833721791a324ad3528bca`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(state.creates).toEqual(["recipient-1"])
```

### apps/web/e2e/internal-conversations.spec.ts:215:15

[apps/web/e2e/internal-conversations.spec.ts:215](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:215); SHA-256 `40fecacf8241203c9fbc6d24aa8f1810264aee17928b5b9a5c1b2c51357ffa77`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
          navigation.getByRole("button", {
            name: "Expand conversations",
            exact: true,
          }),
        ).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:226:13

[apps/web/e2e/internal-conversations.spec.ts:226](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:226); SHA-256 `c4238434d382c20add0578a28e877a2df767e92d94a60fb863d8aacb4b82dfdb`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(clientChats).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:227:13

[apps/web/e2e/internal-conversations.spec.ts:227](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:227); SHA-256 `1fdb7c770c01b18952a98bdc2f241004219f597a5be85ef324d4963712297d71`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        navigation.getByRole("button", {
          name: "Open internal conversations",
          exact: true,
        }),
      ).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:234:13

[apps/web/e2e/internal-conversations.spec.ts:234](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:234); SHA-256 `c23d41a3927767ef147aa1c5c03164b3abda1fb0c6eb575aeba33edc96193035`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(page).toHaveURL(/\/messages$/)
```

### apps/web/e2e/internal-conversations.spec.ts:235:13

[apps/web/e2e/internal-conversations.spec.ts:235](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:235); SHA-256 `d58999b5baa57bacd4e574445e2a2f19aa03b05df45fef183584ecf45de5d803`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        navigation.getByText("Internal chats", { exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:244:13

[apps/web/e2e/internal-conversations.spec.ts:244](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:244); SHA-256 `b1a4f002e818ae6bdbab9bf11a2ada7494ba3ae166f0b42c01d7e7209c6c2512`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(page).toHaveURL(/\/messages\?mode=internal$/)
```

### apps/web/e2e/internal-conversations.spec.ts:245:13

[apps/web/e2e/internal-conversations.spec.ts:245](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:245); SHA-256 `c4238434d382c20add0578a28e877a2df767e92d94a60fb863d8aacb4b82dfdb`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(clientChats).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:246:13

[apps/web/e2e/internal-conversations.spec.ts:246](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:246); SHA-256 `6c3f8614824cf43cef283d48bfb70fae2de40ecafd24046f1bb3aff2dd3cead2`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        navigation.getByRole("link", { name: "Dani Colleague", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:249:7

[apps/web/e2e/internal-conversations.spec.ts:249](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:249); SHA-256 `314e19e1cc0f9e511a7e856164a76b07a1c0617c89248236b6810eb2275a741d`.

Direct callback owners: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

All possible owners, including helper/route/hook candidates: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082.

```ts
expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
```

### apps/web/e2e/internal-conversations.spec.ts:269:9

[apps/web/e2e/internal-conversations.spec.ts:269](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:269); SHA-256 `33c9a671d621bb15f9f551b1775bb384804e4dbd678783587341360f47dcfebc`.

Direct callback owners: PW-083.

All possible owners, including helper/route/hook candidates: PW-083.

```ts
expect(
    page.getByText("Chat unavailable. Try again.", { exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:272:9

[apps/web/e2e/internal-conversations.spec.ts:272](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:272); SHA-256 `02310166892e8be4c580d5b42979572ee555e2f9a29e4bd34d167aae53557c1d`.

Direct callback owners: PW-083.

All possible owners, including helper/route/hook candidates: PW-083.

```ts
expect(
    page
      .getByRole("navigation", { name: "Conversations", exact: true })
      .getByRole("alert"),
  ).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:277:9

[apps/web/e2e/internal-conversations.spec.ts:277](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:277); SHA-256 `b1a4f002e818ae6bdbab9bf11a2ada7494ba3ae166f0b42c01d7e7209c6c2512`.

Direct callback owners: PW-083.

All possible owners, including helper/route/hook candidates: PW-083.

```ts
expect(page).toHaveURL(/\/messages\?mode=internal$/)
```

### apps/web/e2e/internal-conversations.spec.ts:278:3

[apps/web/e2e/internal-conversations.spec.ts:278](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:278); SHA-256 `fd5e9a2733e58d046c7f0babefcc6f105e1c0b172eec1cc6aca91ff4ea54b4f1`.

Direct callback owners: PW-083.

All possible owners, including helper/route/hook candidates: PW-083.

```ts
expect(state.created).toBe(false)
```

### apps/web/e2e/internal-conversations.spec.ts:284:9

[apps/web/e2e/internal-conversations.spec.ts:284](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:284); SHA-256 `a550431df5056fb12d2a375f782339a5621fa6405f8315e49cd1ac4075977274`.

Direct callback owners: PW-083.

All possible owners, including helper/route/hook candidates: PW-083.

```ts
expect(page).toHaveURL(/internal=chat-1$/)
```

### apps/web/e2e/internal-conversations.spec.ts:285:3

[apps/web/e2e/internal-conversations.spec.ts:285](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:285); SHA-256 `eaea95ff3ad3055dbbd388ccff01f978fa2e5c3b5fc17f32d2463056665c7c0f`.

Direct callback owners: PW-083.

All possible owners, including helper/route/hook candidates: PW-083.

```ts
expect(state.creates).toEqual(["recipient-1", "recipient-1"])
```

### apps/web/e2e/internal-conversations.spec.ts:296:9

[apps/web/e2e/internal-conversations.spec.ts:296](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:296); SHA-256 `7f4de603652dd4524bfc9b9df784811e9bdf96d9e341936c6f527abdf7378a22`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(chat.getByRole("textbox")).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:309:9

[apps/web/e2e/internal-conversations.spec.ts:309](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:309); SHA-256 `fec75c7c05f2c6c66fa6f909fa6fcb7b097e318a67d6346c663517ff4dcbc139`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(chat.getByRole("article")).toContainText(
    "Incoming colleague reply",
  )
```

### apps/web/e2e/internal-conversations.spec.ts:312:9

[apps/web/e2e/internal-conversations.spec.ts:312](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:312); SHA-256 `9214ae42822e634c1bbebd6ed8880522a30017c60dcc37a62fb6fc262972ca8c`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect.poll(() => state.reads).toBe(1)
```

### apps/web/e2e/internal-conversations.spec.ts:313:3

[apps/web/e2e/internal-conversations.spec.ts:313](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:313); SHA-256 `74aa5aef11f6ed543f65f1d959611eaa6151e4fa80b4517416c869749f924a48`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(state.unread).toBe(0)
```

### apps/web/e2e/internal-conversations.spec.ts:314:9

[apps/web/e2e/internal-conversations.spec.ts:314](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:314); SHA-256 `801a292d7b145de1bd6b9614ee9c80ef38812042f7b6970ad8d5201ddd2af496`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(
    page
      .getByRole("navigation", { name: "Conversations", exact: true })
      .getByRole("link", { name: "Dani Colleague", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:321:9

[apps/web/e2e/internal-conversations.spec.ts:321](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:321); SHA-256 `0e73ee94e3e5027e41680b4f7a8ad21cc21c6911e397f4ee10e0ade7fc10075e`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(
    chat.getByText("Messaging is unavailable for this account.", {
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:326:9

[apps/web/e2e/internal-conversations.spec.ts:326](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:326); SHA-256 `12194bb0fe817f4815b1bf16ceeb04166f01ac8df6381946c65f6967aca66fb4`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(chat.getByRole("textbox")).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:327:9

[apps/web/e2e/internal-conversations.spec.ts:327](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:327); SHA-256 `fec75c7c05f2c6c66fa6f909fa6fcb7b097e318a67d6346c663517ff4dcbc139`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(chat.getByRole("article")).toContainText(
    "Incoming colleague reply",
  )
```

### apps/web/e2e/internal-conversations.spec.ts:330:3

[apps/web/e2e/internal-conversations.spec.ts:330](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:330); SHA-256 `809e7b670a8a4142601a7ed66e3813c927b9f15917ab44e6469c71ba4c9ff6b1`.

Direct callback owners: PW-084.

All possible owners, including helper/route/hook candidates: PW-084.

```ts
expect(state.sends).toEqual([])
```

### apps/web/e2e/internal-conversations.spec.ts:382:9

[apps/web/e2e/internal-conversations.spec.ts:382](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:382); SHA-256 `6fc084ad5e68c53599599eb72b3dc2d9f1e9351855a1c752091b173155f02af2`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(chat).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:383:9

[apps/web/e2e/internal-conversations.spec.ts:383](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:383); SHA-256 `8a2cdd3a65eb4b743d5b44e337dc3f65f3c8b95092412f4aca93094dc8b8aae4`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(contact).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:384:9

[apps/web/e2e/internal-conversations.spec.ts:384](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:384); SHA-256 `009834eb4879d56d636232ccd57ecb33242a55ea3f4e336b856a5b160e9e9f53`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(nav.getByText("Internal chats", { exact: true })).toBeHidden()
```

### apps/web/e2e/internal-conversations.spec.ts:385:9

[apps/web/e2e/internal-conversations.spec.ts:385](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:385); SHA-256 `a2c6fc3a25515ed3fb34bf86833be549d81ffd1af0a704b1f6d9429432456289`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(nav.getByText("Start a chat", { exact: true })).toBeHidden()
```

### apps/web/e2e/internal-conversations.spec.ts:386:9

[apps/web/e2e/internal-conversations.spec.ts:386](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:386); SHA-256 `eb6105200815a1cc68726a84d5013064b6e7107a5fc15c383b5d585d9894fb50`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(nav.getByText("Senior Designer", { exact: true })).toBeHidden()
```

### apps/web/e2e/internal-conversations.spec.ts:388:9

[apps/web/e2e/internal-conversations.spec.ts:388](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:388); SHA-256 `9151eb4ee87880838a5b3aeaa14647f04afaee75b159fb8d5ee88c2984c14acb`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect
    .poll(() =>
      list.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true)
```

### apps/web/e2e/internal-conversations.spec.ts:393:9

[apps/web/e2e/internal-conversations.spec.ts:393](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:393); SHA-256 `e9a78447555249227be7f9faca992b6549161cc08dfc0d7890076675f127557c`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect
    .poll(() =>
      list.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true)
```

### apps/web/e2e/internal-conversations.spec.ts:401:5

[apps/web/e2e/internal-conversations.spec.ts:401](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:401); SHA-256 `4ac99343fb9909c9d81c08e54fdc941079d6dc0f7c24ad5c4952485a9ea4ffd9`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(box!.x).toBeGreaterThanOrEqual(railBox!.x)
```

### apps/web/e2e/internal-conversations.spec.ts:402:5

[apps/web/e2e/internal-conversations.spec.ts:402](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:402); SHA-256 `96ec46ad8779d987c0b5c67d54f8d27adf65d8a01d8db3067d27e0dd1d184944`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(box!.x + box!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width)
```

### apps/web/e2e/internal-conversations.spec.ts:408:9

[apps/web/e2e/internal-conversations.spec.ts:408](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:408); SHA-256 `87ea40c8780c7baabd590da6cc46c051763c2d28a61380cfb266a9ff1fe2df06`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(nav.getByText("Internal chats", { exact: true })).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:409:9

[apps/web/e2e/internal-conversations.spec.ts:409](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:409); SHA-256 `3643b386c44b85dd4e4eb75774739cc5573730d5c9edf97478ce0645f788951f`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(nav.getByText("Start a chat", { exact: true })).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:410:9

[apps/web/e2e/internal-conversations.spec.ts:410](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:410); SHA-256 `1faf498e027e6c98be3bb57693869dead10e8041c293d6857dc2400673def5c6`.

Direct callback owners: PW-085.

All possible owners, including helper/route/hook candidates: PW-085.

```ts
expect(nav.getByText("Senior Designer", { exact: true })).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:431:9

[apps/web/e2e/internal-conversations.spec.ts:431](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:431); SHA-256 `60e1828f2064c117c3407cb7be7236cd3f6bb8143902798929a0dd6e566b4602`.

Direct callback owners: PW-086.

All possible owners, including helper/route/hook candidates: PW-086.

```ts
expect(
    topbar.getByRole("link", { name: "Messages, 3 unread", exact: true }),
  ).toHaveText("3")
```

### apps/web/e2e/internal-conversations.spec.ts:442:9

[apps/web/e2e/internal-conversations.spec.ts:442](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:442); SHA-256 `4429b40cc6a652cabed9c165927874561b719014a079f95e3acb016aa79734fd`.

Direct callback owners: PW-086.

All possible owners, including helper/route/hook candidates: PW-086.

```ts
expect(link).toBeVisible()
```

### apps/web/e2e/internal-conversations.spec.ts:443:9

[apps/web/e2e/internal-conversations.spec.ts:443](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:443); SHA-256 `034ff01206e9c0b990dacdbafb747507dfd1fd9619c31a9d0636ec1a3b611a3a`.

Direct callback owners: PW-086.

All possible owners, including helper/route/hook candidates: PW-086.

```ts
expect(link.locator("span")).toHaveCount(0)
```

### apps/web/e2e/internal-conversations.spec.ts:444:3

[apps/web/e2e/internal-conversations.spec.ts:444](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:444); SHA-256 `74aa5aef11f6ed543f65f1d959611eaa6151e4fa80b4517416c869749f924a48`.

Direct callback owners: PW-086.

All possible owners, including helper/route/hook candidates: PW-086.

```ts
expect(state.unread).toBe(0)
```

## apps/web/e2e/jwt-session.spec.ts

### apps/web/e2e/jwt-session.spec.ts:34:7

[apps/web/e2e/jwt-session.spec.ts:34](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:34); SHA-256 `64e30b7aa5e4f6baf1296c8004850df8e338b5d5a9d38bad9956036d9c27f228`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(route.request().postDataJSON()).toEqual({
        refreshToken: "original-refresh",
      })
```

### apps/web/e2e/jwt-session.spec.ts:63:3

[apps/web/e2e/jwt-session.spec.ts:63](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:63); SHA-256 `6701ae099686a9b3a91c46c0abd9f16da9c683d133f09fadd8856dd8e303095b`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/)
```

### apps/web/e2e/jwt-session.spec.ts:64:3

[apps/web/e2e/jwt-session.spec.ts:64](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:64); SHA-256 `01d11535847c8541764bfe4a5e41b947b65fc827ef4af05335064ad266b1836a`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
```

### apps/web/e2e/jwt-session.spec.ts:65:9

[apps/web/e2e/jwt-session.spec.ts:65](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:65); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/jwt-session.spec.ts:66:3

[apps/web/e2e/jwt-session.spec.ts:66](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:66); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/jwt-session.spec.ts:67:3

[apps/web/e2e/jwt-session.spec.ts:67](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:67); SHA-256 `43bc56a23ecb634bba8b7e2c3e3fb8cf942259f213737c3bf411b8261bd1b22a`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(
    await page.evaluate(() =>
      sessionStorage.getItem("nexus.auth.refreshToken"),
    ),
  ).toBe("rotated-refresh")
```

### apps/web/e2e/jwt-session.spec.ts:74:9

[apps/web/e2e/jwt-session.spec.ts:74](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:74); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/jwt-session.spec.ts:75:3

[apps/web/e2e/jwt-session.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:75); SHA-256 `bbe8b9c773abb860b8963d5e984f55199cb6b0dc70a1ac63df0892b1473f9c26`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(loggedOut).toBe(true)
```

### apps/web/e2e/jwt-session.spec.ts:76:3

[apps/web/e2e/jwt-session.spec.ts:76](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:76); SHA-256 `43b8c686c2e730f15cfa6a7799845721b2f66683ae92e717e48e9c361c98f46d`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(
    await page.evaluate(() => [
      sessionStorage.getItem("nexus.auth.token"),
      sessionStorage.getItem("nexus.auth.refreshToken"),
    ]),
  ).toEqual([null, null])
```

### apps/web/e2e/jwt-session.spec.ts:82:3

[apps/web/e2e/jwt-session.spec.ts:82](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:82); SHA-256 `8b0930aee89f7117edecacc957234400c3f2de0ca0e53b3971c0b4aa02303bbb`.

Direct callback owners: PW-087.

All possible owners, including helper/route/hook candidates: PW-087.

```ts
expect(errors).toEqual([])
```

### apps/web/e2e/jwt-session.spec.ts:101:3

[apps/web/e2e/jwt-session.spec.ts:101](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:101); SHA-256 `550691c160cf794f76a57feff5255524924d79d05bfc029bebe522cc65212067`.

Direct callback owners: PW-088.

All possible owners, including helper/route/hook candidates: PW-088.

```ts
expect(await page.evaluate(() => "trustedScriptExecuted" in window)).toBe(
    true,
  )
```

### apps/web/e2e/jwt-session.spec.ts:104:3

[apps/web/e2e/jwt-session.spec.ts:104](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:104); SHA-256 `d3843625e5609828073b4e5d6718f03593ee0e25f24a01bda24f78c60195c963`.

Direct callback owners: PW-088.

All possible owners, including helper/route/hook candidates: PW-088.

```ts
expect(await page.evaluate(() => "untrustedScriptExecuted" in window)).toBe(
    false,
  )
```

## apps/web/e2e/login-validation.spec.ts

### apps/web/e2e/login-validation.spec.ts:15:5

[apps/web/e2e/login-validation.spec.ts:15](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:15); SHA-256 `26c3aab50f8b46e566e2ecc00a7229b3c4d72a1b04244281741e7d4bac4fe444`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(route.request().postDataJSON()).toEqual({
      email: "User+tag@example.org",
      password: "  密碼🔒'<>  ",
    })
```

### apps/web/e2e/login-validation.spec.ts:31:9

[apps/web/e2e/login-validation.spec.ts:31](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:31); SHA-256 `c6bae28de3beaf5fb587cd9cacf283e893945923c6b4bbd296ee988e7364143f`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(page.locator("input")).toHaveCount(2)
```

### apps/web/e2e/login-validation.spec.ts:32:9

[apps/web/e2e/login-validation.spec.ts:32](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:32); SHA-256 `74a1f8059014f9686bcbb7be76191f387e601e16682853b1288a9fca5e0f2475`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(email).toHaveValue("")
```

### apps/web/e2e/login-validation.spec.ts:34:9

[apps/web/e2e/login-validation.spec.ts:34](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:34); SHA-256 `627311f3312f72dccdd216784c8932014589db0e70c6c48e7974123402e7b751`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(email).toBeFocused()
```

### apps/web/e2e/login-validation.spec.ts:35:9

[apps/web/e2e/login-validation.spec.ts:35](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:35); SHA-256 `c7e8352aa7305d4c9ad2da8146760e16070cf17ef1f833edd33477e7abb45975`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(email).toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/login-validation.spec.ts:39:11

[apps/web/e2e/login-validation.spec.ts:39](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:39); SHA-256 `c7e8352aa7305d4c9ad2da8146760e16070cf17ef1f833edd33477e7abb45975`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(email).toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/login-validation.spec.ts:42:9

[apps/web/e2e/login-validation.spec.ts:42](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:42); SHA-256 `3502c0a278062e99c35572bbce1f62eee8023c91736ee89acad09321a65ee44d`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(email).toHaveValue("a".repeat(254))
```

### apps/web/e2e/login-validation.spec.ts:45:9

[apps/web/e2e/login-validation.spec.ts:45](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:45); SHA-256 `651b66ff303f6198c906b1f23a0ae3363b2018a829d618c6e0b740cd79c161af`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(password).toBeFocused()
```

### apps/web/e2e/login-validation.spec.ts:46:9

[apps/web/e2e/login-validation.spec.ts:46](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:46); SHA-256 `d5478cbb4ca060759effcd0fdf46a797d74fbadbc19c07cdcb9e017b53bf0e4b`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(password).toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/login-validation.spec.ts:49:9

[apps/web/e2e/login-validation.spec.ts:49](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:49); SHA-256 `d5478cbb4ca060759effcd0fdf46a797d74fbadbc19c07cdcb9e017b53bf0e4b`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(password).toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/login-validation.spec.ts:50:3

[apps/web/e2e/login-validation.spec.ts:50](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:50); SHA-256 `0a4169e6d5019c99d0655297c5cc198228313b12b9d3918572eb0a18b881f283`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(requests).toBe(0)
```

### apps/web/e2e/login-validation.spec.ts:53:9

[apps/web/e2e/login-validation.spec.ts:53](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:53); SHA-256 `448b5501f12ab829213df993fc77a207a0b7df4685a44974577d8a5d0536f6ce`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(password).toHaveAttribute("type", "text")
```

### apps/web/e2e/login-validation.spec.ts:55:9

[apps/web/e2e/login-validation.spec.ts:55](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:55); SHA-256 `e920810dc032c095dbe7b31e05ca4eef67f1d0da3da10a848b7407a6140f0a18`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(password).toHaveAttribute("type", "password")
```

### apps/web/e2e/login-validation.spec.ts:62:9

[apps/web/e2e/login-validation.spec.ts:62](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:62); SHA-256 `1635f52ded7b901b9b287862f2a80b6b7a6137bfe1ab7ca2dc6914d630476e9b`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(submit).toBeDisabled()
```

### apps/web/e2e/login-validation.spec.ts:63:9

[apps/web/e2e/login-validation.spec.ts:63](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:63); SHA-256 `a5c053537562a30296dd0351bc9347c0f3e9af0c201f024da71e21393d870268`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect.poll(() => requests).toBe(1)
```

### apps/web/e2e/login-validation.spec.ts:65:9

[apps/web/e2e/login-validation.spec.ts:65](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:65); SHA-256 `9c144b505151a81913b3e2bb0a784f956979490c96247b4649d66d8dc34d063f`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(submit).toBeEnabled()
```

### apps/web/e2e/login-validation.spec.ts:66:9

[apps/web/e2e/login-validation.spec.ts:66](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:66); SHA-256 `69a9d842868dc17387a92aeaaeb75f72ffa5aa393947987b46811a36178ead71`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(
    page.getByText("Email or password is incorrect. Please try again.", {
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/login-validation.spec.ts:71:3

[apps/web/e2e/login-validation.spec.ts:71](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:71); SHA-256 `089fc46d34084aae7596df45071bb799b361b72933d06ab444c530e14342f4b1`.

Direct callback owners: PW-089.

All possible owners, including helper/route/hook candidates: PW-089.

```ts
expect(new URL(page.url()).pathname).toBe("/login")
```

### apps/web/e2e/login-validation.spec.ts:85:9

[apps/web/e2e/login-validation.spec.ts:85](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:85); SHA-256 `b763ee48aba997afbce74f048a4772df37699765f08a1eb564417fed65bb21b0`.

Direct callback owners: PW-090.

All possible owners, including helper/route/hook candidates: PW-090.

```ts
expect(page.getByRole("menuitemradio")).toHaveCount(2)
```

### apps/web/e2e/login-validation.spec.ts:89:9

[apps/web/e2e/login-validation.spec.ts:89](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:89); SHA-256 `ba9de6ce58ab4c9508962769623d7c375ea7853917bf461651f16f55ee8564ee`.

Direct callback owners: PW-090.

All possible owners, including helper/route/hook candidates: PW-090.

```ts
expect(page.locator("#email-error")).toHaveText(
    getAuthCopy("fil").emailRequired,
  )
```

### apps/web/e2e/login-validation.spec.ts:92:9

[apps/web/e2e/login-validation.spec.ts:92](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:92); SHA-256 `ef0867185f4747e6fec9a69538fa5b4be5ccafeac8ee9d052a2b77893d96ed1a`.

Direct callback owners: PW-090.

All possible owners, including helper/route/hook candidates: PW-090.

```ts
expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/login-validation.spec.ts:94:9

[apps/web/e2e/login-validation.spec.ts:94](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:94); SHA-256 `d6563afe63e9dae4556bc064296b95791ec31e145e0162b9725a55f7d1f1775a`.

Direct callback owners: PW-090.

All possible owners, including helper/route/hook candidates: PW-090.

```ts
expect(page.getByRole("button", { name: /Filipino/ })).toBeVisible()
```

## apps/web/e2e/messages-topbar.spec.ts

### apps/web/e2e/messages-topbar.spec.ts:38:11

[apps/web/e2e/messages-topbar.spec.ts:38](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:38); SHA-256 `8f199c8746a83f99ea339a825094a66a110eaba7fc96ece398734ef4e1071663`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(
      topbar.getByRole("link", {
        name: `Messages, ${initialCount} unread`,
        exact: true,
      }),
    ).toHaveText(String(initialCount))
```

### apps/web/e2e/messages-topbar.spec.ts:44:26

[apps/web/e2e/messages-topbar.spec.ts:44](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:44); SHA-256 `8afa7ca192fd8fa408279df45ad7369fd136e26170165a546ce655394aa5f214`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(internalReads).toBe(0)
```

### apps/web/e2e/messages-topbar.spec.ts:45:5

[apps/web/e2e/messages-topbar.spec.ts:45](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:45); SHA-256 `8f3c334cc498cfa7b76f448ffb9694abc8b5e0651f75ad46d773e8d11dd270bf`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(requestReads).toBe(1)
```

### apps/web/e2e/messages-topbar.spec.ts:50:11

[apps/web/e2e/messages-topbar.spec.ts:50](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:50); SHA-256 `93548bdfcc41895207b7088c7db8bef107f6587b13b77ee82cbce906188f0e83`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(
      topbar.getByRole("link", {
        name: `Messages, ${largeCount} unread`,
        exact: true,
      }),
    ).toHaveText("99+")
```

### apps/web/e2e/messages-topbar.spec.ts:60:11

[apps/web/e2e/messages-topbar.spec.ts:60](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:60); SHA-256 `93548bdfcc41895207b7088c7db8bef107f6587b13b77ee82cbce906188f0e83`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(
      topbar.getByRole("link", {
        name: `Messages, ${largeCount} unread`,
        exact: true,
      }),
    ).toHaveText("99+")
```

### apps/web/e2e/messages-topbar.spec.ts:72:11

[apps/web/e2e/messages-topbar.spec.ts:72](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:72); SHA-256 `4429b40cc6a652cabed9c165927874561b719014a079f95e3acb016aa79734fd`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(link).toBeVisible()
```

### apps/web/e2e/messages-topbar.spec.ts:73:11

[apps/web/e2e/messages-topbar.spec.ts:73](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:73); SHA-256 `034ff01206e9c0b990dacdbafb747507dfd1fd9619c31a9d0636ec1a3b611a3a`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(link.locator("span")).toHaveCount(0)
```

### apps/web/e2e/messages-topbar.spec.ts:75:11

[apps/web/e2e/messages-topbar.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:75); SHA-256 `c23d41a3927767ef147aa1c5c03164b3abda1fb0c6eb575aeba33edc96193035`.

Direct callback owners: PW-091, PW-092, PW-093, PW-094.

All possible owners, including helper/route/hook candidates: PW-091, PW-092, PW-093, PW-094.

```ts
expect(page).toHaveURL(/\/messages$/)
```

## apps/web/e2e/operational-loading.spec.ts

### apps/web/e2e/operational-loading.spec.ts:108:17

[apps/web/e2e/operational-loading.spec.ts:108](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:108); SHA-256 `c1b1a51f625433570a39949a918c877877ca6e8ead508f63eddc8c4c9d8201a5`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(title).toBeVisible()
```

### apps/web/e2e/operational-loading.spec.ts:142:15

[apps/web/e2e/operational-loading.spec.ts:142](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:142); SHA-256 `68258d60b3ce785878377685423aceaea7e7c1372ef65ed8bdcf80d036cd7023`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(table).toHaveAttribute("aria-busy", "true")
```

### apps/web/e2e/operational-loading.spec.ts:143:15

[apps/web/e2e/operational-loading.spec.ts:143](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:143); SHA-256 `16631ea63be57fbaed60e518cfdbfdaf92ca6e48de99dd97892e9565e4a326c3`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(table.getByRole("status")).toHaveText(
          `Loading ${scenario.label}…`,
        )
```

### apps/web/e2e/operational-loading.spec.ts:146:15

[apps/web/e2e/operational-loading.spec.ts:146](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:146); SHA-256 `1d0d9b87ef04600022698ead00a3af723c464b6c0f479b6ecfa1012817b68841`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(table.locator(".animate-pulse")).toHaveCount(60)
```

### apps/web/e2e/operational-loading.spec.ts:148:17

[apps/web/e2e/operational-loading.spec.ts:148](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:148); SHA-256 `8d5a25435a93a47da5ce3fe6a34dbdecd0d44798566a91a1483dc8e3e19b93aa`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(
            page.getByRole("heading", { name: "Request Inbox", exact: true }),
          ).toHaveCSS("color", referenceColors.title)
```

### apps/web/e2e/operational-loading.spec.ts:151:17

[apps/web/e2e/operational-loading.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:151); SHA-256 `332ec352b1eb8e3796cea1729d7e34fbe25bb1e2db4a55a2ec5920c92b470ea0`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(page.locator("main header p")).toHaveCSS(
            "color",
            referenceColors.description,
          )
```

### apps/web/e2e/operational-loading.spec.ts:156:19

[apps/web/e2e/operational-loading.spec.ts:156](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:156); SHA-256 `9198d0a938ff8572e8de46e3bd63318d3f890d1703f53561f0cd70ed595e83b1`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(header).toHaveCSS("color", referenceColors.column)
```

### apps/web/e2e/operational-loading.spec.ts:162:19

[apps/web/e2e/operational-loading.spec.ts:162](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:162); SHA-256 `e9e2c4416402ac34521a22f8bccccbe47a9171ae7b2602a87d8dab5250baaa1f`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(button).toHaveCSS("color", referenceColors.column)
```

### apps/web/e2e/operational-loading.spec.ts:163:19

[apps/web/e2e/operational-loading.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:163); SHA-256 `3d1f9bf0a2b9ad3637ac39a48fbc0d061b71d483bbe4c360a1f17a3b58df0457`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(button).toHaveCSS("color", "rgb(7, 15, 31)")
```

### apps/web/e2e/operational-loading.spec.ts:167:17

[apps/web/e2e/operational-loading.spec.ts:167](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:167); SHA-256 `15e0667f402fa01053fc5300d3f1684f66d1e8269a1dd425a7407f8b1f0b90a9`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(
            page.getByRole("region", { name: "Project summary" }),
          ).toHaveAttribute("aria-busy", "true")
```

### apps/web/e2e/operational-loading.spec.ts:173:15

[apps/web/e2e/operational-loading.spec.ts:173](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:173); SHA-256 `b60e2fad95d9c7de17d54ce253a64a3c05f0ad5e568122d730098b971ded3c0c`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(table).toHaveAttribute("aria-busy", "false")
```

### apps/web/e2e/operational-loading.spec.ts:174:15

[apps/web/e2e/operational-loading.spec.ts:174](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:174); SHA-256 `1fe42ef7efaff6723a8de8dcc5965d17a18ea7933e346821a7c45bf2fc613723`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(table.locator(".animate-pulse")).toHaveCount(0)
```

### apps/web/e2e/operational-loading.spec.ts:175:15

[apps/web/e2e/operational-loading.spec.ts:175](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:175); SHA-256 `1399184d512df7a30e1fe6156be1faa7dfc86a0a185c786c3f56e896440ebcaa`.

Direct callback owners: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

All possible owners, including helper/route/hook candidates: PW-095, PW-096, PW-097, PW-098, PW-099, PW-100.

```ts
expect(
          table.getByRole("cell").filter({ hasText: scenario.content }).first(),
        ).toBeVisible()
```

## apps/web/e2e/portal-regression.spec.ts

### apps/web/e2e/portal-regression.spec.ts:18:11

[apps/web/e2e/portal-regression.spec.ts:18](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:18); SHA-256 `d391e432ead5ecbdab9ac3b870f1ab9bae70107719a61e3da467d7f6b35dfb04`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/portal-regression.spec.ts:21:11

[apps/web/e2e/portal-regression.spec.ts:21](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:21); SHA-256 `8643bc3862e5419c32d377248be1836051e659845df23f8cafd542dfe6b1ec02`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(
      page.getByRole("tab", { name: "Security", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/portal-regression.spec.ts:25:11

[apps/web/e2e/portal-regression.spec.ts:25](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:25); SHA-256 `d391e432ead5ecbdab9ac3b870f1ab9bae70107719a61e3da467d7f6b35dfb04`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/portal-regression.spec.ts:28:5

[apps/web/e2e/portal-regression.spec.ts:28](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:28); SHA-256 `47b1776559c458699f70191fd502a651136821430ede0ed39a1c504022dffaac`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
```

### apps/web/e2e/portal-regression.spec.ts:36:11

[apps/web/e2e/portal-regression.spec.ts:36](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:36); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/portal-regression.spec.ts:37:5

[apps/web/e2e/portal-regression.spec.ts:37](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:37); SHA-256 `2601bd3591480a25ac9dbc07a8204e3a9b5db25d96187d26c7cd4afe16125cd1`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(workloadRequests).toEqual([])
```

### apps/web/e2e/portal-regression.spec.ts:38:11

[apps/web/e2e/portal-regression.spec.ts:38](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:38); SHA-256 `3fd32dac2ac556ffa8e88576aadce2bc5dcb25f4f7ae91d4158c24d7dcd00441`.

Direct callback owners: PW-101, PW-102, PW-103, PW-104.

All possible owners, including helper/route/hook candidates: PW-101, PW-102, PW-103, PW-104.

```ts
expect(
      page.getByRole("link", { name: "Workflow Approvals", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/portal-regression.spec.ts:53:5

[apps/web/e2e/portal-regression.spec.ts:53](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:53); SHA-256 `74b12a991c94bffe9809e35dd9d90eac21e5d1920e574b769e77aa6dc546e1bd`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect(route.request().headers().authorization).toBe("Bearer test-session")
```

### apps/web/e2e/portal-regression.spec.ts:54:5

[apps/web/e2e/portal-regression.spec.ts:54](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:54); SHA-256 `6e33765dcdc460015057861d6f1ff811fb0aec258ad90b24e17ec67eab7c80ea`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect(new URL(route.request().url()).searchParams.get("week")).toBe(
      "2026-11-02",
    )
```

### apps/web/e2e/portal-regression.spec.ts:68:9

[apps/web/e2e/portal-regression.spec.ts:68](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:68); SHA-256 `9dd7235417662d87069c2b06be9ed077cc5439d47acc2bf4e009edf3d94c4cf3`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/portal-regression.spec.ts:71:9

[apps/web/e2e/portal-regression.spec.ts:71](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:71); SHA-256 `bea1b847e4984809deb4633f2fd1a735177573a0df604788f5e5fb0d02be5fe3`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect.poll(() => reads).toBeGreaterThan(0)
```

### apps/web/e2e/portal-regression.spec.ts:73:9

[apps/web/e2e/portal-regression.spec.ts:73](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:73); SHA-256 `9dd7235417662d87069c2b06be9ed077cc5439d47acc2bf4e009edf3d94c4cf3`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/portal-regression.spec.ts:76:9

[apps/web/e2e/portal-regression.spec.ts:76](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:76); SHA-256 `a2198d0b0c9b9855544acf836b15579e0f700f7ec1ab7d428b8469659c1d008d`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect.poll(() => reads).toBeGreaterThan(1)
```

### apps/web/e2e/portal-regression.spec.ts:77:3

[apps/web/e2e/portal-regression.spec.ts:77](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:77); SHA-256 `47b1776559c458699f70191fd502a651136821430ede0ed39a1c504022dffaac`.

Direct callback owners: PW-105.

All possible owners, including helper/route/hook candidates: PW-105.

```ts
expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
```

## apps/web/e2e/pricing-templates.spec.ts

### apps/web/e2e/pricing-templates.spec.ts:74:13

[apps/web/e2e/pricing-templates.spec.ts:74](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:74); SHA-256 `a19ec8796d3122b1eb7ca2a01c0ee88835551571557b496e0756c068bfc5124f`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(manager).toContainText("Used by 1 service: Test Service")
```

### apps/web/e2e/pricing-templates.spec.ts:75:13

[apps/web/e2e/pricing-templates.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:75); SHA-256 `dd1bb35937c57082b133a10623e719f5ac2a6c81de3c570e68425c46224b1046`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        manager.getByRole("button", { name: "Delete Template", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/pricing-templates.spec.ts:87:13

[apps/web/e2e/pricing-templates.spec.ts:87](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:87); SHA-256 `4c69a88693def4cff946a8d813dd47593033a1152ea941357a9f673a504b93a2`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(manager.getByRole("alert")).toHaveText(
        "Select a billing interval",
      )
```

### apps/web/e2e/pricing-templates.spec.ts:102:7

[apps/web/e2e/pricing-templates.spec.ts:102](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:102); SHA-256 `565c8be3458a16ccae42885c187e6f5a8f286e3bfcc6d16f03404ed584344756`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect((await saved).postDataJSON()).toEqual({
        name: "Monthly support",
        pricingModel: "RECURRING",
        currency: "PHP",
        amount: 1500.5,
        billingInterval: "MONTHLY",
        isPublic: false,
      })
```

### apps/web/e2e/pricing-templates.spec.ts:110:13

[apps/web/e2e/pricing-templates.spec.ts:110](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:110); SHA-256 `7c1504cd65fe9a4caaaf57034061b28887b073c2d834c643fbd7e7439ca473cb`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        manager.getByLabel("Pricing Template", { exact: true }),
      ).toContainText("Monthly support")
```

### apps/web/e2e/pricing-templates.spec.ts:126:13

[apps/web/e2e/pricing-templates.spec.ts:126](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:126); SHA-256 `c58c5a3f4905a9d64cf35c08687172e2986fbd1e72766cc0914f5abfe4e1aca0`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        manager.getByLabel("Template Name", { exact: true }),
      ).toHaveValue("Unused pricing")
```

### apps/web/e2e/pricing-templates.spec.ts:135:13

[apps/web/e2e/pricing-templates.spec.ts:135](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:135); SHA-256 `713c0c0212aeaba436605f37a4647fcdad3121ba1adf30852c511c3f853843d3`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        manager.getByLabel("Template Name", { exact: true }),
      ).toHaveValue("Monthly support")
```

### apps/web/e2e/pricing-templates.spec.ts:156:13

[apps/web/e2e/pricing-templates.spec.ts:156](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:156); SHA-256 `23b0825ca3390ba733dde6a9c8c698a6093bee06732899b256283364856dd319`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        serviceDialog.getByLabel("Pricing Template", { exact: true }),
      ).toContainText("Monthly support")
```

### apps/web/e2e/pricing-templates.spec.ts:162:13

[apps/web/e2e/pricing-templates.spec.ts:162](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:162); SHA-256 `061ab6079185ff07fd17f0659bc248a0f586291b570beb44d7556ed3de1668d8`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(manager.getByLabel("Amount (PHP)")).toHaveValue("1500.50")
```

### apps/web/e2e/pricing-templates.spec.ts:163:13

[apps/web/e2e/pricing-templates.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:163); SHA-256 `493311928e0e420d094717d8c056ae78ac94d35a7f54bcb1cdfa0f3ab09403ee`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(manager.getByLabel("Billing Interval")).toContainText(
        "Monthly",
      )
```

### apps/web/e2e/pricing-templates.spec.ts:167:13

[apps/web/e2e/pricing-templates.spec.ts:167](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:167); SHA-256 `5daedb5a7971b73f807991ad384bf595cb3f3ab0114218895bbd3dfff633f107`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        page.getByRole("option", { name: "Unused pricing", exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/pricing-templates.spec.ts:178:13

[apps/web/e2e/pricing-templates.spec.ts:178](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:178); SHA-256 `4961f6a3561661568bd18088ceab92a4a9d2239c0e8337a7841fc58e14bdb0a6`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(serviceDialog.getByLabel("Service Name")).toHaveValue(
        "Unsubmitted service draft",
      )
```

### apps/web/e2e/pricing-templates.spec.ts:200:13

[apps/web/e2e/pricing-templates.spec.ts:200](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:200); SHA-256 `b112b2d50550c1b98860dc72fc19a14ae29e0e3b36314afc10c8dbc47cb5d4f9`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(serviceDialog).toHaveCount(0)
```

### apps/web/e2e/pricing-templates.spec.ts:204:13

[apps/web/e2e/pricing-templates.spec.ts:204](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:204); SHA-256 `e668a9b7dc218430913d375cb91bfb920be5fe1ff311d1b99a0dbb5cef4a7542`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(
        manager.getByRole("button", { name: "Delete Template", exact: true }),
      ).toBeEnabled()
```

### apps/web/e2e/pricing-templates.spec.ts:213:13

[apps/web/e2e/pricing-templates.spec.ts:213](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:213); SHA-256 `e0e75eaeb4482c012cf009d5f4f9a670ee6e0c2b87111c5d0cafdd504d384ecc`.

Direct callback owners: PW-106, PW-107.

All possible owners, including helper/route/hook candidates: PW-106, PW-107.

```ts
expect(manager).toContainText("No pricing templates yet")
```

### apps/web/e2e/pricing-templates.spec.ts:243:11

[apps/web/e2e/pricing-templates.spec.ts:243](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:243); SHA-256 `6ed57ee0a5751313fb9006193868c4b0ed685ed6cb337b24fe710de486e837cf`.

Direct callback owners: PW-108.

All possible owners, including helper/route/hook candidates: PW-108.

```ts
expect(manager.getByRole("alert")).toHaveText("Permission revoked")
```

### apps/web/e2e/pricing-templates.spec.ts:244:11

[apps/web/e2e/pricing-templates.spec.ts:244](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:244); SHA-256 `d8cc03695519abcdc8c871894cf5146d15435031e6dd2d0d8f4e03a90d8dfb66`.

Direct callback owners: PW-108.

All possible owners, including helper/route/hook candidates: PW-108.

```ts
expect(
      manager.getByLabel("Template Name", { exact: true }),
    ).toHaveValue("Draft template name")
```

### apps/web/e2e/pricing-templates.spec.ts:262:11

[apps/web/e2e/pricing-templates.spec.ts:262](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:262); SHA-256 `2b89d67a5a369d4c15e27c7bc2d32f868e5c39322716caaf80f8be3b8d1782de`.

Direct callback owners: PW-108.

All possible owners, including helper/route/hook candidates: PW-108.

```ts
expect(manager.getByRole("alert")).toHaveText(
      "Temporary deletion failure",
    )
```

### apps/web/e2e/pricing-templates.spec.ts:268:11

[apps/web/e2e/pricing-templates.spec.ts:268](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:268); SHA-256 `e0e75eaeb4482c012cf009d5f4f9a670ee6e0c2b87111c5d0cafdd504d384ecc`.

Direct callback owners: PW-108.

All possible owners, including helper/route/hook candidates: PW-108.

```ts
expect(manager).toContainText("No pricing templates yet")
```

### apps/web/e2e/pricing-templates.spec.ts:281:11

[apps/web/e2e/pricing-templates.spec.ts:281](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:281); SHA-256 `d92dee4f5af84bc42610c2b487b109cfae9ce367d872cf91c22e951096dcf64c`.

Direct callback owners: PW-109.

All possible owners, including helper/route/hook candidates: PW-109.

```ts
expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
```

### apps/web/e2e/pricing-templates.spec.ts:284:11

[apps/web/e2e/pricing-templates.spec.ts:284](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:284); SHA-256 `c5dc49dbeeb3e4df32543c13539fd8d058cb9573d459fdb25c641d01be791b15`.

Direct callback owners: PW-109.

All possible owners, including helper/route/hook candidates: PW-109.

```ts
expect(
      page.getByRole("button", { name: "Pricing Templates", exact: true }),
    ).toHaveCount(0)
```

## apps/web/e2e/profile.spec.ts

### apps/web/e2e/profile.spec.ts:87:9

[apps/web/e2e/profile.spec.ts:87](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:87); SHA-256 `06a9d3f39ec28732a17f079e0cad97286a3b51c7b85968cdc408953f76a9669e`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(dataUrl).toMatch(/^data:image\/png;base64,/)
```

### apps/web/e2e/profile.spec.ts:114:11

[apps/web/e2e/profile.spec.ts:114](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:114); SHA-256 `ee757f7e37160c6d316b19846d0e2aebd36e2af5063a9e0f09edeaf02db415de`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("heading", { name: "My profile", exact: true }),
    ).toBeVisible({ timeout: 30000 })
```

### apps/web/e2e/profile.spec.ts:121:11

[apps/web/e2e/profile.spec.ts:121](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:121); SHA-256 `7e58e32293e14e4e62f1f79b36a45fc9c326616f5c587878d7c9bc4a0fd156a7`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(page.getByLabel("Email address")).toHaveAttribute(
      "readonly",
      "",
    )
```

### apps/web/e2e/profile.spec.ts:126:11

[apps/web/e2e/profile.spec.ts:126](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:126); SHA-256 `a37ccaf7dfbd801dec5dc450e7c74e2cd06d01f72fea1a56a4ad14a73397fdcf`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("heading", { name: "Alex Updated" }),
    ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:139:11

[apps/web/e2e/profile.spec.ts:139](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:139); SHA-256 `8a042500db061e1fe8861a12de56a1773a6ad2be2b155b0c1fdbd3ee0f5bd7b5`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("img", { name: "Profile picture preview", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:142:5

[apps/web/e2e/profile.spec.ts:142](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:142); SHA-256 `c3523ce67943bf3359a6c4480217fedd938dd99cb99583129c8b45fdeabfb161`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(imageWrites).toEqual([])
```

### apps/web/e2e/profile.spec.ts:144:11

[apps/web/e2e/profile.spec.ts:144](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:144); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/profile.spec.ts:145:5

[apps/web/e2e/profile.spec.ts:145](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:145); SHA-256 `c3523ce67943bf3359a6c4480217fedd938dd99cb99583129c8b45fdeabfb161`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(imageWrites).toEqual([])
```

### apps/web/e2e/profile.spec.ts:149:11

[apps/web/e2e/profile.spec.ts:149](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:149); SHA-256 `573d5f9191175f05ee03a0a25040101844405c50f91bf380ae03146214cf4f71`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/profile.spec.ts:166:11

[apps/web/e2e/profile.spec.ts:166](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:166); SHA-256 `8a042500db061e1fe8861a12de56a1773a6ad2be2b155b0c1fdbd3ee0f5bd7b5`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("img", { name: "Profile picture preview", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:169:11

[apps/web/e2e/profile.spec.ts:169](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:169); SHA-256 `0f67d4d08b771eacfbeb94665734095b79a42dc4ddef83df433cf3a04ac77986`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("img", { name: "Cover banner preview", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:172:11

[apps/web/e2e/profile.spec.ts:172](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:172); SHA-256 `a195aa36125d115d857a1dd2f5d4a97b388c08c6c731eb251a76d1aa760a9233`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeEnabled()
```

### apps/web/e2e/profile.spec.ts:175:11

[apps/web/e2e/profile.spec.ts:175](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:175); SHA-256 `7f87d23a6e92c63fe5a30192bfa178cb2ac5b4a307aea10e2b7a0b5391e36af0`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("button", { name: "Remove selected image", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/profile.spec.ts:178:11

[apps/web/e2e/profile.spec.ts:178](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:178); SHA-256 `f588cb8ebfb4ecc4b13b714d631357edbc307c439f1510950915b594ee1f5815`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByText("Not uploaded yet", { exact: false }),
    ).toHaveCount(0)
```

### apps/web/e2e/profile.spec.ts:181:5

[apps/web/e2e/profile.spec.ts:181](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:181); SHA-256 `c3523ce67943bf3359a6c4480217fedd938dd99cb99583129c8b45fdeabfb161`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(imageWrites).toEqual([])
```

### apps/web/e2e/profile.spec.ts:183:11

[apps/web/e2e/profile.spec.ts:183](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:183); SHA-256 `fa6b0f819168e031308b8381f25eed7cf7adaa8a83b04205ec813c869c79325a`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect
      .poll(async () => {
        const box = await page.getByRole("dialog").boundingBox()
        return !!box && box.x >= 16 && box.x + box.width <= 1264
      })
      .toBe(true)
```

### apps/web/e2e/profile.spec.ts:194:11

[apps/web/e2e/profile.spec.ts:194](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:194); SHA-256 `f91523a2c30977ca992a00aef835075cec36c9254d01e9364046bdfe84bbd76e`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect
      .poll(async () => {
        const box = await page.getByRole("dialog").boundingBox()
        return !!box && box.x >= 12 && box.width <= 366
      })
      .toBe(true)
```

### apps/web/e2e/profile.spec.ts:212:13

[apps/web/e2e/profile.spec.ts:212](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:212); SHA-256 `2edad0563fac1af2ec17fbf2aa3ba3e3504d5d8361d7448c7b90a9d9bc6fff4f`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Cover banner was not saved." }),
      ).toContainText("Profile picture saved.")
```

### apps/web/e2e/profile.spec.ts:217:7

[apps/web/e2e/profile.spec.ts:217](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:217); SHA-256 `62c249352d3b5400cdec8a67d347faa7c9b7ed967f268817b058f4a0c0a0a33a`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(imageWrites).toEqual(["avatar", "banner"])
```

### apps/web/e2e/profile.spec.ts:218:13

[apps/web/e2e/profile.spec.ts:218](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:218); SHA-256 `6e25a65ba51d389bfc72a843a682d1c3dcf1182ba96bb7c8f87955c57a616926`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(page.getByRole("dialog")).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:222:13

[apps/web/e2e/profile.spec.ts:222](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:222); SHA-256 `fdd8516c7f4d39af24ba831ba6c59475692ac5d1e9df8c9eec2eded385e7c650`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect
        .poll(() => imageWrites)
        .toEqual(["avatar", "banner", "banner"])
```

### apps/web/e2e/profile.spec.ts:225:18

[apps/web/e2e/profile.spec.ts:225](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:225); SHA-256 `e6e0503664347ea3038c018872cf6471b433460d71ca39b6d8916faead1359f7`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect.poll(() => imageWrites).toEqual(["avatar", "banner"])
```

### apps/web/e2e/profile.spec.ts:226:11

[apps/web/e2e/profile.spec.ts:226](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:226); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/profile.spec.ts:227:5

[apps/web/e2e/profile.spec.ts:227](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:227); SHA-256 `d8ebcaaf28a2d81eae67255ba37748c2f02d2c1f625990f3357fbd96d42c3ea5`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(profile.imageUrl).toBe("https://profile-test.supabase.co/avatar.png")
```

### apps/web/e2e/profile.spec.ts:228:5

[apps/web/e2e/profile.spec.ts:228](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:228); SHA-256 `1664b8271e023fab53347c9aa314a164cd2d36f5e657db00f8b2b77120fef0d8`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(profile.bannerUrl).toBe(
      "https://profile-test.supabase.co/banner.png",
    )
```

### apps/web/e2e/profile.spec.ts:231:11

[apps/web/e2e/profile.spec.ts:231](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:231); SHA-256 `1e8ec950aa35a34c07244fb17693a3f7c8e7b444670405852e77f73e3737a4ba`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("img", { name: "Profile banner", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:251:13

[apps/web/e2e/profile.spec.ts:251](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:251); SHA-256 `3ba6924f1070c6bc40ea4e6888cc97212e81492261fed23f3b86da5ee435b613`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
        page.getByRole("img", { name: "Project 1 image preview", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:257:13

[apps/web/e2e/profile.spec.ts:257](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:257); SHA-256 `a876069df967833b6c344fdf38f499640dd9f59befdf233262a1ccedc20086cd`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
        page.getByLabel("Project image URL", { exact: true }),
      ).toHaveValue("https://profile-test.supabase.co/project.png")
```

### apps/web/e2e/profile.spec.ts:270:7

[apps/web/e2e/profile.spec.ts:270](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:270); SHA-256 `a1945355ea3d356ab3a0ede1f00790486718e31502bf72bfebab7ddf167af9d4`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(profile.specialist!.projects[0].isPublished).toBe(true)
```

### apps/web/e2e/profile.spec.ts:278:13

[apps/web/e2e/profile.spec.ts:278](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:278); SHA-256 `4f43d74fac4c945d490793f63cf3ac9decc86b713ba848a9163fe1ea3e16ac26`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(projectDialog).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:279:13

[apps/web/e2e/profile.spec.ts:279](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:279); SHA-256 `ff51f555f074c1f3c87529aa6696cade7a6105c65cb5f8fdc75a7b0192eb2f0a`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(projectDialog).toContainText(
        "A responsive website for a local business.",
      )
```

### apps/web/e2e/profile.spec.ts:283:13

[apps/web/e2e/profile.spec.ts:283](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:283); SHA-256 `63090a7ae07cf4ddd6ca3a5ce2b5a0054e2ff4d0344c67bf19cc99520b51af1b`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(projectDialog).not.toBeVisible()
```

### apps/web/e2e/profile.spec.ts:285:13

[apps/web/e2e/profile.spec.ts:285](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:285); SHA-256 `75b8c87e6c2431f1e02e83d279afaa62f25a2442a053f083f24d95eda78e7f5a`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
        page.getByRole("heading", { name: "Specialist profile", exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/profile.spec.ts:290:11

[apps/web/e2e/profile.spec.ts:290](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:290); SHA-256 `4438bb02042bef6d93cf58daf6e8bd1193db2a050bc165a62b4095360ed7f393`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("menuitem", { name: "Profile", exact: true }),
    ).toHaveAttribute("href", "/profile")
```

### apps/web/e2e/profile.spec.ts:300:11

[apps/web/e2e/profile.spec.ts:300](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:300); SHA-256 `f7be48a0e306d0b8abb8fd2ae0fa8a24d0642295b0dd781c304e990ad24c0299`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByRole("heading", { name: "My profile", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/profile.spec.ts:303:5

[apps/web/e2e/profile.spec.ts:303](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:303); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/profile.spec.ts:308:11

[apps/web/e2e/profile.spec.ts:308](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:308); SHA-256 `cfeac8c2d7cebaca9c49c2a7d8299a9da03d52111e1115c206839e3550bd907a`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect
      .poll(() =>
        page
          .getByRole("main", { name: "My profile", exact: true })
          .evaluate((element) => element.scrollWidth - element.clientWidth),
      )
      .toBeLessThanOrEqual(0)
```

### apps/web/e2e/profile.spec.ts:322:11

[apps/web/e2e/profile.spec.ts:322](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:322); SHA-256 `560b728ae4a75c88ecfe6354692a8aaf9cbc1e41f22766b1e8ca9410fef561f8`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(page).toHaveURL(/\/settings/)
```

### apps/web/e2e/profile.spec.ts:327:11

[apps/web/e2e/profile.spec.ts:327](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:327); SHA-256 `40c12b39005f661d28cb1588320de0c55c8e4ccb76743c6b35c3225defd8383d`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page.getByLabel("Current password", { exact: true }),
    ).toHaveAttribute("type", "text")
```

### apps/web/e2e/profile.spec.ts:340:11

[apps/web/e2e/profile.spec.ts:340](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:340); SHA-256 `7047936641f587b1581ef8a6f1bef0956d7d6d0cd0f063237ccb3a55cfa4756a`.

Direct callback owners: PW-110, PW-111, PW-112, PW-113.

All possible owners, including helper/route/hook candidates: PW-110, PW-111, PW-112, PW-113.

```ts
expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The new passwords do not match" }),
    ).toContainText("The new passwords do not match")
```

## apps/web/e2e/project-pages-regression.spec.ts

### apps/web/e2e/project-pages-regression.spec.ts:59:11

[apps/web/e2e/project-pages-regression.spec.ts:59](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:59); SHA-256 `f39cea96ff4ca4d7802cd0001cb061d529bd079653f85a3a5ff2b22857b881be`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByRole("link", { name: workspace.name, exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/project-pages-regression.spec.ts:62:11

[apps/web/e2e/project-pages-regression.spec.ts:62](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:62); SHA-256 `8817a138968e0b820688727be7d0c573db461bbff2b0f0f2f9cd59833fd54753`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByText("Completed branding", { exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/project-pages-regression.spec.ts:68:11

[apps/web/e2e/project-pages-regression.spec.ts:68](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:68); SHA-256 `aa90381b8c0bfc2329cf78d9efed093f6f49f101d7207a16516d3d714bc0c793`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByText("No projects match these filters.", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/project-pages-regression.spec.ts:72:11

[apps/web/e2e/project-pages-regression.spec.ts:72](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:72); SHA-256 `0ea68b3e0c0512246b939112737e28f4b2db9c54f522304b6e21917959775a04`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      main.getByRole("searchbox", { name: "Search projects" }),
    ).toHaveValue("")
```

### apps/web/e2e/project-pages-regression.spec.ts:75:11

[apps/web/e2e/project-pages-regression.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:75); SHA-256 `cb748ee79de112109be34b965654d5b3d0c4f9bb7401146dbf6986ecfd84fae5`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByRole("link", { name: "Completed branding", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/project-pages-regression.spec.ts:78:11

[apps/web/e2e/project-pages-regression.spec.ts:78](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:78); SHA-256 `467fe14526c56cf2f7a82f5a36df70f3a12526462e1f111aafe911468ff34d2e`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByRole("link", { name: "Cancelled campaign", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/project-pages-regression.spec.ts:81:11

[apps/web/e2e/project-pages-regression.spec.ts:81](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:81); SHA-256 `d07ebe685b7a85407bc13df4cbfcc42bf8a3bfbc820f1d8626dc546207859275`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(table.getByText(workspace.name, { exact: true })).toHaveCount(
      0,
    )
```

### apps/web/e2e/project-pages-regression.spec.ts:87:11

[apps/web/e2e/project-pages-regression.spec.ts:87](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:87); SHA-256 `50af0e53f3d72b30c412dda6346517bf5f2343bc5d5676672cf98b4cf887a1c7`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByText("Cancelled campaign", { exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/project-pages-regression.spec.ts:90:11

[apps/web/e2e/project-pages-regression.spec.ts:90](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:90); SHA-256 `34f15703810b52967fb43e3de9a6d5865304020b4b004eac9f7d02e98ac0401e`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      table.getByRole("link", { name: "Completed branding", exact: true }),
    ).toHaveAttribute("href", "/project-workspace/archive-1")
```

### apps/web/e2e/project-pages-regression.spec.ts:93:11

[apps/web/e2e/project-pages-regression.spec.ts:93](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:93); SHA-256 `52dce36f0ae441fa93e0adf861be85a847cae01232c303c39188f183ee9aef21`.

Direct callback owners: PW-114, PW-117.

All possible owners, including helper/route/hook candidates: PW-114, PW-117.

```ts
expect(
      main.getByRole("button", { name: "New project", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/project-pages-regression.spec.ts:147:13

[apps/web/e2e/project-pages-regression.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:147); SHA-256 `96e816f966ba41bf2731fabaee05bdbe71309eadce6c2c30dabd61ea15dfe35c`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(main.getByRole("alert")).toHaveText(
        "Project temporarily unavailable",
      )
```

### apps/web/e2e/project-pages-regression.spec.ts:150:13

[apps/web/e2e/project-pages-regression.spec.ts:150](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:150); SHA-256 `5666c960f8bd718d8f6bff838d6c7e92631c1390693004dac086ce3eb6f81942`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(
        main.getByRole("heading", { name: workspace.name, exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/project-pages-regression.spec.ts:156:13

[apps/web/e2e/project-pages-regression.spec.ts:156](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:156); SHA-256 `c4606ef169d4091fa645517b47004e6c62d28b28d35ea947b481b03b378f228e`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(
        main.getByRole("heading", { name: workspace.name, exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/project-pages-regression.spec.ts:159:13

[apps/web/e2e/project-pages-regression.spec.ts:159](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:159); SHA-256 `031af5e5e08bfb701c552a0dc444d81ba73f47d020fae425ce0fc898a76d0f75`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(main.getByRole("alert")).toHaveCount(0)
```

### apps/web/e2e/project-pages-regression.spec.ts:160:7

[apps/web/e2e/project-pages-regression.spec.ts:160](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:160); SHA-256 `395001e3fb51bc851ceb56a6d295f0d2e4b65193ed367a75559e9943a936cb10`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(reads).toBeGreaterThan(failedReads)
```

### apps/web/e2e/project-pages-regression.spec.ts:176:17

[apps/web/e2e/project-pages-regression.spec.ts:176](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:176); SHA-256 `4ec074356c42bc21258962e878eb509b0bcc5b070f978d2dc45ab783df7c94ae`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(
            main.getByRole("heading", { name: content, exact: true }),
          ).toBeVisible()
```

### apps/web/e2e/project-pages-regression.spec.ts:180:15

[apps/web/e2e/project-pages-regression.spec.ts:180](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:180); SHA-256 `589f0f7e75584b0b86e3059bb44b87085eaaf6b31f939b5be165d1d89b577377`.

Direct callback owners: PW-115, PW-116, PW-118, PW-119.

All possible owners, including helper/route/hook candidates: PW-115, PW-116, PW-118, PW-119.

```ts
expect(
          main.getByRole("button", { name: "Manage project status" }),
        ).toHaveCount(0)
```

## apps/web/e2e/project-workspace.spec.ts

### apps/web/e2e/project-workspace.spec.ts:39:5

[apps/web/e2e/project-workspace.spec.ts:39](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:39); SHA-256 `dc9835025df732a69260a6d3df64d4e93f4e764109e187f314a9bc61617ff176`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-120, PW-121, PW-122, PW-123.

```ts
expect(route.request().headers().authorization).toBe(
      "Bearer project-session",
    )
```

### apps/web/e2e/project-workspace.spec.ts:51:7

[apps/web/e2e/project-workspace.spec.ts:51](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:51); SHA-256 `37f0334e9516f43e4bfef00001784c28b86cb72f10bd622bd283bf048bc0f4b8`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-120, PW-121, PW-122, PW-123.

```ts
expect(route.request().method()).toBe("PATCH")
```

### apps/web/e2e/project-workspace.spec.ts:75:9

[apps/web/e2e/project-workspace.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:75); SHA-256 `e6dc3d002f25f462dadec236f28265c6d77d52150dc8d93b4f13155641d4c637`.

Direct callback owners: PW-120.

All possible owners, including helper/route/hook candidates: PW-120.

```ts
expect(
    page.getByRole("heading", { name: "Business website", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:78:9

[apps/web/e2e/project-workspace.spec.ts:78](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:78); SHA-256 `68e86645044280b1616f18618b49f0e294d65d4563fe8e6b15bd93e18ddf50be`.

Direct callback owners: PW-120.

All possible owners, including helper/route/hook candidates: PW-120.

```ts
expect(page.getByText("Design approval", { exact: true })).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:79:9

[apps/web/e2e/project-workspace.spec.ts:79](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:79); SHA-256 `b645a3c417382c7336d6cf6b70d2b5760b13ea3d9b1c4b7727d459ee4f446c12`.

Direct callback owners: PW-120.

All possible owners, including helper/route/hook candidates: PW-120.

```ts
expect(
    page.getByRole("link", { name: "View service conversation" }),
  ).toHaveAttribute("href", "/messages?request=request-1")
```

### apps/web/e2e/project-workspace.spec.ts:82:9

[apps/web/e2e/project-workspace.spec.ts:82](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:82); SHA-256 `0e7929242483fa94f13033ba8b8ce32fb0e53f808302ec210fd26408d20ad9af`.

Direct callback owners: PW-120.

All possible owners, including helper/route/hook candidates: PW-120.

```ts
expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(
    0,
  )
```

### apps/web/e2e/project-workspace.spec.ts:85:3

[apps/web/e2e/project-workspace.spec.ts:85](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:85); SHA-256 `e82ed6c58971764b3a6a6925af8d149e3fb11123a504ba6daa143efbe6c4cc46`.

Direct callback owners: PW-120.

All possible owners, including helper/route/hook candidates: PW-120.

```ts
expect(writes).toHaveLength(0)
```

### apps/web/e2e/project-workspace.spec.ts:86:3

[apps/web/e2e/project-workspace.spec.ts:86](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:86); SHA-256 `d8aa5941b039f3949ee56645492f6f8ebdc19450bc9f4556b68711e49608aaaf`.

Direct callback owners: PW-120.

All possible owners, including helper/route/hook candidates: PW-120.

```ts
expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
```

### apps/web/e2e/project-workspace.spec.ts:104:11

[apps/web/e2e/project-workspace.spec.ts:104](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:104); SHA-256 `73b1f8860d17cccf59f35cf8e15b358667cfae1977c517253864b4f081201fb5`.

Direct callback owners: PW-121, PW-122.

All possible owners, including helper/route/hook candidates: PW-121, PW-122.

```ts
expect(
      page.getByText("Couldn't update milestone", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:107:11

[apps/web/e2e/project-workspace.spec.ts:107](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:107); SHA-256 `f74c73e3ed0c3d05f3884251280556186af685b7caed890ae181ee40cf7fc449`.

Direct callback owners: PW-121, PW-122.

All possible owners, including helper/route/hook candidates: PW-121, PW-122.

```ts
expect(page.getByText("0/1 completed", { exact: true })).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:108:11

[apps/web/e2e/project-workspace.spec.ts:108](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:108); SHA-256 `e0d193e29df254c919983072be46d5dc6c6cb639f9e9b9e454d6232bb9d1f7c3`.

Direct callback owners: PW-121, PW-122.

All possible owners, including helper/route/hook candidates: PW-121, PW-122.

```ts
expect(
      page.getByRole("button", { name: "Mark complete", exact: true }),
    ).toBeEnabled()
```

### apps/web/e2e/project-workspace.spec.ts:115:11

[apps/web/e2e/project-workspace.spec.ts:115](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:115); SHA-256 `135f2a9af10d6439cfa9713c6adec2b6313d8e6c14bc5d3aa3a547382bca0020`.

Direct callback owners: PW-121, PW-122.

All possible owners, including helper/route/hook candidates: PW-121, PW-122.

```ts
expect(page.getByText("1/1 completed", { exact: true })).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:116:5

[apps/web/e2e/project-workspace.spec.ts:116](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:116); SHA-256 `1ca655f3790f49753705c6ba2a4534fe7b8e700e7e8990c69d95825ec407557d`.

Direct callback owners: PW-121, PW-122.

All possible owners, including helper/route/hook candidates: PW-121, PW-122.

```ts
expect(writes).toEqual([{ completed: true }, { completed: true }])
```

### apps/web/e2e/project-workspace.spec.ts:126:9

[apps/web/e2e/project-workspace.spec.ts:126](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:126); SHA-256 `135f2a9af10d6439cfa9713c6adec2b6313d8e6c14bc5d3aa3a547382bca0020`.

Direct callback owners: PW-123.

All possible owners, including helper/route/hook candidates: PW-123.

```ts
expect(page.getByText("1/1 completed", { exact: true })).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:128:9

[apps/web/e2e/project-workspace.spec.ts:128](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:128); SHA-256 `f74c73e3ed0c3d05f3884251280556186af685b7caed890ae181ee40cf7fc449`.

Direct callback owners: PW-123.

All possible owners, including helper/route/hook candidates: PW-123.

```ts
expect(page.getByText("0/1 completed", { exact: true })).toBeVisible()
```

### apps/web/e2e/project-workspace.spec.ts:129:3

[apps/web/e2e/project-workspace.spec.ts:129](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:129); SHA-256 `5a30abbd3a7f0a6f5ad1c9627b4867d941de71229671c417ccd05a37e36637ac`.

Direct callback owners: PW-123.

All possible owners, including helper/route/hook candidates: PW-123.

```ts
expect(writes).toEqual([{ completed: true }, { completed: false }])
```

### apps/web/e2e/project-workspace.spec.ts:130:9

[apps/web/e2e/project-workspace.spec.ts:130](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:130); SHA-256 `cfc18f6f596de49374cdf15e89f0ad36d8cb99d2298f7d892493e9bc442693d7`.

Direct callback owners: PW-123.

All possible owners, including helper/route/hook candidates: PW-123.

```ts
expect(
    page.getByRole("link", { name: "View service conversation" }),
  ).toHaveCount(0)
```

## apps/web/e2e/regression-live.spec.ts

### apps/web/e2e/regression-live.spec.ts:79:9

[apps/web/e2e/regression-live.spec.ts:79](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:79); SHA-256 `2f42eec594c008f7c0f89ab9f554d193aa3fec96f9ecd7a63d058999fe2a4b09`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(response.status(), `${role} login must succeed`).toBe(200)
```

### apps/web/e2e/regression-live.spec.ts:80:9

[apps/web/e2e/regression-live.spec.ts:80](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:80); SHA-256 `be1e2df8f3f983ef4e5cae78aff517db7cb5b4a8691eef2f2880eb3494ccc50c`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(payload.user?.email).toBe(testAccounts[role].email)
```

### apps/web/e2e/regression-live.spec.ts:81:9

[apps/web/e2e/regression-live.spec.ts:81](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:81); SHA-256 `e6820a28a593543541308787b0259e594e1089c11437d2a0e5b2ddc7505816af`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(payload.user?.role).toBe(role)
```

### apps/web/e2e/regression-live.spec.ts:82:9

[apps/web/e2e/regression-live.spec.ts:82](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:82); SHA-256 `6716c691c235063ddfff377462a8a12059f563da6ed0bcefe27b5c341d1a4065`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(payload.user?.isActive).toBe(true)
```

### apps/web/e2e/regression-live.spec.ts:83:9

[apps/web/e2e/regression-live.spec.ts:83](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:83); SHA-256 `5e7aff573ff9d51f66ade2f6d735caee442c02ea7588d217748e3c65977f2c7b`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
          typeof payload.token === "string" &&
            payload.token.split(".").length === 3,
        ).toBe(true)
```

### apps/web/e2e/regression-live.spec.ts:87:9

[apps/web/e2e/regression-live.spec.ts:87](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:87); SHA-256 `9584ae38860652c1ac1dcb142bf3a3bd2a54e7559a0d7fb27327dccbb41ab4f6`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
          typeof payload.refreshToken === "string" &&
            /^[A-Za-z0-9_-]{43}$/.test(payload.refreshToken),
        ).toBe(true)
```

### apps/web/e2e/regression-live.spec.ts:91:9

[apps/web/e2e/regression-live.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:91); SHA-256 `d603289ae07c8e83527e27e2b08c7055bbd409e72fc14891436be7a002d1f051`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(payload.expiresIn).toBeGreaterThan(0)
```

### apps/web/e2e/regression-live.spec.ts:92:9

[apps/web/e2e/regression-live.spec.ts:92](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:92); SHA-256 `829bae17bacf9bac5aaf0d85ad9646adfc46aa37df99f6d5a3b49d7ae15a8495`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(payload.expiresIn).toBeLessThanOrEqual(900)
```

### apps/web/e2e/regression-live.spec.ts:93:9

[apps/web/e2e/regression-live.spec.ts:93](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:93); SHA-256 `eaf43d7a60ddf008e4261e324ad6f0b28d15de41b479377f0a70d1e3adf106a1`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(response.headers()["cache-control"]).toBe("no-store")
```

### apps/web/e2e/regression-live.spec.ts:94:15

[apps/web/e2e/regression-live.spec.ts:94](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:94); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression-live.spec.ts:95:9

[apps/web/e2e/regression-live.spec.ts:95](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:95); SHA-256 `38df69ada321455e6707a2e2f298348b53951d25a31c477b18222b9693060595`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
          await page.evaluate(() =>
            Boolean(sessionStorage.getItem("nexus.auth.token")),
          ),
        ).toBe(true)
```

### apps/web/e2e/regression-live.spec.ts:100:9

[apps/web/e2e/regression-live.spec.ts:100](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:100); SHA-256 `68dfb19f39bfbd69d2834b181675c237bdaaa9817667b2b8f1795c5e3d838e78`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
          await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
        ).toBeNull()
```

### apps/web/e2e/regression-live.spec.ts:103:9

[apps/web/e2e/regression-live.spec.ts:103](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:103); SHA-256 `d7484d63d14931297ed4debc16a0eb065766157ff52194c8ac690bec7e7a4e5a`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
          await page.evaluate(() =>
            Boolean(sessionStorage.getItem("nexus.auth.refreshToken")),
          ),
        ).toBe(true)
```

### apps/web/e2e/regression-live.spec.ts:108:9

[apps/web/e2e/regression-live.spec.ts:108](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:108); SHA-256 `c6d065e4d64e546324312a3652d5380ac24cd0c21cbcce536564be19b883a72c`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
          await page.evaluate(() =>
            localStorage.getItem("nexus.auth.refreshToken"),
          ),
        ).toBeNull()
```

### apps/web/e2e/regression-live.spec.ts:125:13

[apps/web/e2e/regression-live.spec.ts:125](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:125); SHA-256 `ec9cff998e871cfca6679b631032350885a65f49d78be3678c4aa5e23c6d03e2`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect((await loaded).status(), `${role} ${feature.endpoint}`).toBe(
              200,
            )
```

### apps/web/e2e/regression-live.spec.ts:128:19

[apps/web/e2e/regression-live.spec.ts:128](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:128); SHA-256 `bcf1d7ef6412acea7b552578e65d5fa6f19a361c2d6184baaf593e6e37547055`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
              page.getByRole("heading", {
                name: clientCatalog
                  ? "Build Your Brand with EXP"
                  : feature.title,
                exact: true,
              }),
            ).toBeVisible()
```

### apps/web/e2e/regression-live.spec.ts:136:19

[apps/web/e2e/regression-live.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:136); SHA-256 `8cec01a8892c3cff851b6c78b83d3531ae878c61040e6cc52bcb7ca89198ed12`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(page.getByRole("main").getByRole("alert")).toHaveCount(
              0,
            )
```

### apps/web/e2e/regression-live.spec.ts:147:19

[apps/web/e2e/regression-live.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:147); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression-live.spec.ts:149:13

[apps/web/e2e/regression-live.spec.ts:149](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:149); SHA-256 `53c546ef7bf9aafe924d0e5b3c0cf630c2b8f6e7f847792d202c53c053af35f0`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(
              requests,
              `Forbidden page must not load ${feature.endpoint}`,
            ).toEqual([])
```

### apps/web/e2e/regression-live.spec.ts:168:11

[apps/web/e2e/regression-live.spec.ts:168](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:168); SHA-256 `5f7f5dc4f88a3b5217608add7f155db572811fab7e8cf551d20541f9abb701c3`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(status, `${role} direct read of ${feature.endpoint}`).toBe(
            allowed ? 200 : 403,
          )
```

### apps/web/e2e/regression-live.spec.ts:188:9

[apps/web/e2e/regression-live.spec.ts:188](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:188); SHA-256 `f377e64954ded849d4db1897e58b3366ad4a1804bc201d4222518b225b707d09`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(catalog).toEqual({ status: 200, activeOnly: true })
```

### apps/web/e2e/regression-live.spec.ts:204:11

[apps/web/e2e/regression-live.spec.ts:204](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:204); SHA-256 `42e8c094795f4574b16924f6eab68b886fd2df2df64443b36ce63f7a8881cc3c`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect([204, 401]).toContain(logout.status())
```

### apps/web/e2e/regression-live.spec.ts:208:13

[apps/web/e2e/regression-live.spec.ts:208](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:208); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-124, PW-125, PW-126, PW-127.

All possible owners, including helper/route/hook candidates: PW-124, PW-125, PW-126, PW-127.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression-live.spec.ts:220:7

[apps/web/e2e/regression-live.spec.ts:220](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:220); SHA-256 `42e8c094795f4574b16924f6eab68b886fd2df2df64443b36ce63f7a8881cc3c`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect([204, 401]).toContain(logout.status())
```

### apps/web/e2e/regression-live.spec.ts:226:5

[apps/web/e2e/regression-live.spec.ts:226](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:226); SHA-256 `edb4ef1fd70edbbabe4575519ac4a2d0ca24b2f7ea48846ac443fa571da9fc1d`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(response.status()).toBe(401)
```

### apps/web/e2e/regression-live.spec.ts:227:5

[apps/web/e2e/regression-live.spec.ts:227](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:227); SHA-256 `9b28712208f0e5809f5fa3ca2fe6e621ad1b24719a253bb1ef3b4b51339f00dd`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(payload).not.toHaveProperty("token")
```

### apps/web/e2e/regression-live.spec.ts:228:5

[apps/web/e2e/regression-live.spec.ts:228](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:228); SHA-256 `4335e8d8bd5f69d8ebf7756ef4c60d48b076a2ee8ef5893d88b17b95ca06cc26`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(payload).not.toHaveProperty("refreshToken")
```

### apps/web/e2e/regression-live.spec.ts:229:11

[apps/web/e2e/regression-live.spec.ts:229](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:229); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression-live.spec.ts:230:11

[apps/web/e2e/regression-live.spec.ts:230](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:230); SHA-256 `77d5861df50aee8bf5738ae66054919196dd26a021c1c25dd39f35de635fdcc3`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(
      page.getByText("Sign-in failed", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/regression-live.spec.ts:233:5

[apps/web/e2e/regression-live.spec.ts:233](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:233); SHA-256 `9fb3ca2eef5efa5b42efeee7e866c743df64e5f6eaa7603ae4fb3b431f519ca5`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/regression-live.spec.ts:237:11

[apps/web/e2e/regression-live.spec.ts:237](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:237); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-128.

All possible owners, including helper/route/hook candidates: PW-128.

```ts
expect(page).toHaveURL(/\/login$/)
```

## apps/web/e2e/regression-support.ts

### apps/web/e2e/regression-support.ts:60:5

[apps/web/e2e/regression-support.ts:60](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:60); SHA-256 `e8063a7362fa53b7e0d1c9a326ce1f94adc1eb7eadba26e4cb1b752d6980eb2b`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-001, PW-002, PW-003, PW-004, PW-005, PW-006, PW-007, PW-008, PW-009, PW-010, PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049, PW-050, PW-051, PW-052, PW-053, PW-054, PW-055, PW-056, PW-057, PW-058, PW-059, PW-060, PW-061, PW-062, PW-063, PW-064, PW-065, PW-066, PW-067, PW-068, PW-069, PW-070, PW-073, PW-074, PW-075, PW-076, PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086, PW-091, PW-092, PW-093, PW-094, PW-095, PW-096, PW-097, PW-098, PW-099, PW-100, PW-101, PW-102, PW-103, PW-104, PW-105, PW-106, PW-107, PW-108, PW-109, PW-114, PW-115, PW-116, PW-117, PW-118, PW-119, PW-120, PW-121, PW-122, PW-123, PW-124, PW-125, PW-126, PW-127, PW-128, PW-129, PW-130, PW-131, PW-132, PW-133, PW-134, PW-135, PW-136, PW-137, PW-138, PW-139, PW-140, PW-141, PW-142, PW-143, PW-144, PW-145, PW-146, PW-147, PW-148, PW-149, PW-150, PW-151, PW-152, PW-153, PW-154, PW-155, PW-156, PW-157, PW-158, PW-249, PW-250, PW-251, PW-252, PW-253, PW-254, PW-255, PW-256, PW-257, PW-258, PW-259, PW-260, PW-269, PW-270, PW-271, PW-272, PW-273, PW-274, PW-275, PW-276, PW-277, PW-278, PW-279, PW-280, PW-281, PW-282, PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(pageErrors.get(page)).toEqual([])
```

### apps/web/e2e/regression-support.ts:256:5

[apps/web/e2e/regression-support.ts:256](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:256); SHA-256 `382ce13d03ce0e12e721ecb3c9571fa92363c7e0d62164ec534de56320c479f3`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-001, PW-002, PW-003, PW-004, PW-005, PW-006, PW-007, PW-008, PW-009, PW-010, PW-021, PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049, PW-050, PW-051, PW-052, PW-053, PW-054, PW-055, PW-056, PW-057, PW-058, PW-059, PW-060, PW-061, PW-062, PW-063, PW-064, PW-065, PW-066, PW-067, PW-068, PW-069, PW-070, PW-073, PW-074, PW-075, PW-076, PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086, PW-091, PW-092, PW-093, PW-094, PW-095, PW-096, PW-097, PW-098, PW-099, PW-100, PW-101, PW-102, PW-103, PW-104, PW-105, PW-106, PW-107, PW-108, PW-109, PW-129, PW-130, PW-131, PW-132, PW-133, PW-134, PW-135, PW-136, PW-137, PW-138, PW-139, PW-140, PW-142, PW-143, PW-146, PW-147, PW-149, PW-150, PW-152, PW-153, PW-154, PW-155, PW-157, PW-249, PW-250, PW-251, PW-252, PW-253, PW-254, PW-255, PW-256, PW-257, PW-258, PW-259, PW-260, PW-269, PW-270, PW-271, PW-272, PW-273, PW-274, PW-275, PW-276, PW-277, PW-278, PW-279, PW-280, PW-281, PW-282, PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(url.origin).toBe(new URL(page.url()).origin)
```

### apps/web/e2e/regression-support.ts:309:5

[apps/web/e2e/regression-support.ts:309](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:309); SHA-256 `62270a4f1b9a50b36ea1e69cef05687e5164e5f4ca19d09dd4932f87873b3e7b`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-001, PW-002, PW-003, PW-004, PW-005, PW-006, PW-007, PW-008, PW-009, PW-010, PW-021, PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049, PW-050, PW-051, PW-052, PW-053, PW-054, PW-055, PW-056, PW-057, PW-058, PW-059, PW-060, PW-061, PW-062, PW-063, PW-064, PW-065, PW-066, PW-067, PW-068, PW-069, PW-070, PW-073, PW-074, PW-075, PW-076, PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086, PW-091, PW-092, PW-093, PW-094, PW-095, PW-096, PW-097, PW-098, PW-099, PW-100, PW-101, PW-102, PW-103, PW-104, PW-105, PW-106, PW-107, PW-108, PW-109, PW-129, PW-130, PW-131, PW-132, PW-133, PW-134, PW-135, PW-136, PW-137, PW-138, PW-139, PW-140, PW-142, PW-143, PW-146, PW-147, PW-149, PW-150, PW-152, PW-153, PW-154, PW-155, PW-157, PW-249, PW-250, PW-251, PW-252, PW-253, PW-254, PW-255, PW-256, PW-257, PW-258, PW-259, PW-260, PW-269, PW-270, PW-271, PW-272, PW-273, PW-274, PW-275, PW-276, PW-277, PW-278, PW-279, PW-280, PW-281, PW-282, PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(request.headers().authorization).toBe(
      `Bearer ${options?.accessToken?.() ?? "test-session"}`,
    )
```

### apps/web/e2e/regression-support.ts:733:7

[apps/web/e2e/regression-support.ts:733](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:733); SHA-256 `9ebcc4b40173c4098939b24a176b3d97e747e30595f8e7324fb392e2b5aaa2f0`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-001, PW-002, PW-003, PW-004, PW-005, PW-006, PW-007, PW-008, PW-009, PW-010, PW-021, PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049, PW-050, PW-051, PW-052, PW-053, PW-054, PW-055, PW-056, PW-057, PW-058, PW-059, PW-060, PW-061, PW-062, PW-063, PW-064, PW-065, PW-066, PW-067, PW-068, PW-069, PW-070, PW-073, PW-074, PW-075, PW-076, PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086, PW-091, PW-092, PW-093, PW-094, PW-095, PW-096, PW-097, PW-098, PW-099, PW-100, PW-101, PW-102, PW-103, PW-104, PW-105, PW-106, PW-107, PW-108, PW-109, PW-129, PW-130, PW-131, PW-132, PW-133, PW-134, PW-135, PW-136, PW-137, PW-138, PW-139, PW-140, PW-142, PW-143, PW-146, PW-147, PW-149, PW-150, PW-152, PW-153, PW-154, PW-155, PW-157, PW-249, PW-250, PW-251, PW-252, PW-253, PW-254, PW-255, PW-256, PW-257, PW-258, PW-259, PW-260, PW-269, PW-270, PW-271, PW-272, PW-273, PW-274, PW-275, PW-276, PW-277, PW-278, PW-279, PW-280, PW-281, PW-282, PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(
        service,
        "Service mutation must target an existing fixture",
      ).toBeDefined()
```

## apps/web/e2e/regression.spec.ts

### apps/web/e2e/regression.spec.ts:44:11

[apps/web/e2e/regression.spec.ts:44](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:44); SHA-256 `4b7ab3ab823b5d8f8d967e7ff610ed74f3c3c7a70ac02fa8283cdeaf07ecb2ff`.

Direct callback owners: PW-129.

All possible owners, including helper/route/hook candidates: PW-129.

```ts
expect(
      page.getByText("The server is having trouble. Please try again shortly."),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:47:5

[apps/web/e2e/regression.spec.ts:47](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:47); SHA-256 `d8f2086013709ac48daf7f5606c3d565e532ca6b1906303cedc7b337bfd8574e`.

Direct callback owners: PW-129.

All possible owners, including helper/route/hook candidates: PW-129.

```ts
expect(await storedTokens(page)).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:48:11

[apps/web/e2e/regression.spec.ts:48](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:48); SHA-256 `816f141be33c2a93c61a7646ed1ec015d45c9a25ae64ed1434bc05d98183428a`.

Direct callback owners: PW-129.

All possible owners, including helper/route/hook candidates: PW-129.

```ts
expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
      "retry@example.com",
    )
```

### apps/web/e2e/regression.spec.ts:52:11

[apps/web/e2e/regression.spec.ts:52](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:52); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-129.

All possible owners, including helper/route/hook candidates: PW-129.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression.spec.ts:53:5

[apps/web/e2e/regression.spec.ts:53](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:53); SHA-256 `8f1348f7e80e8c0a908041fb47803d79a6a05c91d810e5240cf31aea708ae1cd`.

Direct callback owners: PW-129.

All possible owners, including helper/route/hook candidates: PW-129.

```ts
expect(attempts).toBe(2)
```

### apps/web/e2e/regression.spec.ts:54:5

[apps/web/e2e/regression.spec.ts:54](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:54); SHA-256 `47b1776559c458699f70191fd502a651136821430ede0ed39a1c504022dffaac`.

Direct callback owners: PW-129.

All possible owners, including helper/route/hook candidates: PW-129.

```ts
expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
```

### apps/web/e2e/regression.spec.ts:73:9

[apps/web/e2e/regression.spec.ts:73](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:73); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/regression.spec.ts:74:9

[apps/web/e2e/regression.spec.ts:74](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:74); SHA-256 `a54da390f281bbe5fc94d7c21e35b81aaa84ece8daf1105e014133b908d0d290`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(route.request().headers().authorization).toBeUndefined()
```

### apps/web/e2e/regression.spec.ts:75:9

[apps/web/e2e/regression.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:75); SHA-256 `a03b01cac4e9516e5d84a2af12a9ff083968524a8dd5b17baa2598508864f264`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(route.request().postDataJSON()).toEqual({
          refreshToken: "test-refresh",
        })
```

### apps/web/e2e/regression.spec.ts:82:13

[apps/web/e2e/regression.spec.ts:82](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:82); SHA-256 `67e8f5ed47d38427b98ba133ec2dc0611cd2ed7e3c2973f40c4e04cc938ddace`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(
        page.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:85:7

[apps/web/e2e/regression.spec.ts:85](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:85); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/regression.spec.ts:86:7

[apps/web/e2e/regression.spec.ts:86](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:86); SHA-256 `d31c9e07564112119f091914d612b2131d44ba77cbf7ea234a26da787d0b93ed`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(await storedTokens(page)).toEqual([
        renewedTokens.token,
        renewedTokens.refreshToken,
      ])
```

### apps/web/e2e/regression.spec.ts:91:13

[apps/web/e2e/regression.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:91); SHA-256 `67e8f5ed47d38427b98ba133ec2dc0611cd2ed7e3c2973f40c4e04cc938ddace`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(
        page.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:94:7

[apps/web/e2e/regression.spec.ts:94](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:94); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/regression.spec.ts:95:7

[apps/web/e2e/regression.spec.ts:95](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:95); SHA-256 `6654d4fd1ca60a7759cb650cd31a0ad681cf8a2968682cd6dbc72a33814d0a4a`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(
        await page.evaluate(() => [
          localStorage.getItem("nexus.auth.token"),
          localStorage.getItem("nexus.auth.refreshToken"),
        ]),
      ).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:101:7

[apps/web/e2e/regression.spec.ts:101](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:101); SHA-256 `4473a038709f4081f05fae1d9c5d29ae5606b2f9c85600b5076e5eb73fb258f9`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(
        (await page.context().cookies()).some((cookie) =>
          [renewedTokens.token, renewedTokens.refreshToken].includes(
            cookie.value,
          ),
        ),
      ).toBe(false)
```

### apps/web/e2e/regression.spec.ts:112:7

[apps/web/e2e/regression.spec.ts:112](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:112); SHA-256 `7ce02430dcefbe69071cfec4306caef9073a63ca7c1cb074e68cff38325f5341`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect((await logout).headers().authorization).toBe(
        `Bearer ${renewedTokens.token}`,
      )
```

### apps/web/e2e/regression.spec.ts:115:13

[apps/web/e2e/regression.spec.ts:115](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:115); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:116:7

[apps/web/e2e/regression.spec.ts:116](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:116); SHA-256 `d8f2086013709ac48daf7f5606c3d565e532ca6b1906303cedc7b337bfd8574e`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(await storedTokens(page)).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:118:13

[apps/web/e2e/regression.spec.ts:118](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:118); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-130, PW-131, PW-132, PW-133.

All possible owners, including helper/route/hook candidates: PW-130, PW-131, PW-132, PW-133.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:147:11

[apps/web/e2e/regression.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:147); SHA-256 `1161adc50bd1fbae5822cb7f46a842d007808ca35f1f865a8d595d50a0607990`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(authorization).toBe(`Bearer ${renewedTokens.token}`)
```

### apps/web/e2e/regression.spec.ts:155:7

[apps/web/e2e/regression.spec.ts:155](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:155); SHA-256 `7d7cf2a608b4bc51e29657b77421a8c47f34c724a9bd3068b40054e0b92ade67`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(route.request().postDataJSON()).toEqual({
        refreshToken: "test-refresh",
      })
```

### apps/web/e2e/regression.spec.ts:163:11

[apps/web/e2e/regression.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:163); SHA-256 `5c01c7aa7221e924bfe0fc29566ec45d16507c03304268aef1400ccc42011996`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(
      page.getByRole("rowheader", { name: "Test Service", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:166:5

[apps/web/e2e/regression.spec.ts:166](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:166); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/regression.spec.ts:167:5

[apps/web/e2e/regression.spec.ts:167](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:167); SHA-256 `e8a7012bb1a9c5ae101059f71eae3f261a87b0af834700f48a5ce369747162d3`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(expiredPaths.sort()).toEqual([...paths].sort())
```

### apps/web/e2e/regression.spec.ts:168:5

[apps/web/e2e/regression.spec.ts:168](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:168); SHA-256 `405f30261f21a0ad32f82544dd030d17a0e1c9d226c5537274d28e6776cf48d5`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(retriedPaths.sort()).toEqual([...paths].sort())
```

### apps/web/e2e/regression.spec.ts:169:5

[apps/web/e2e/regression.spec.ts:169](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:169); SHA-256 `84697eaaa5629125999e457422109b25b489a6a4ad393c8bc881275bdbc54300`.

Direct callback owners: PW-134.

All possible owners, including helper/route/hook candidates: PW-134.

```ts
expect(await storedTokens(page)).toEqual([
      renewedTokens.token,
      renewedTokens.refreshToken,
    ])
```

### apps/web/e2e/regression.spec.ts:189:9

[apps/web/e2e/regression.spec.ts:189](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:189); SHA-256 `a03b01cac4e9516e5d84a2af12a9ff083968524a8dd5b17baa2598508864f264`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(route.request().postDataJSON()).toEqual({
          refreshToken: "test-refresh",
        })
```

### apps/web/e2e/regression.spec.ts:204:15

[apps/web/e2e/regression.spec.ts:204](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:204); SHA-256 `1cdee3122aaf4fb84dd809a7db85f7590759a7bbb999f02dca2048b116fa51c0`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(
          page.getByRole("button", { name: "Sign In", exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:208:15

[apps/web/e2e/regression.spec.ts:208](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:208); SHA-256 `8dc219898b1936a20146ae77c87d32e6bb24226f5ce4373d88f691a65a8d8927`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect.poll(() => storedTokens(page)).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:209:9

[apps/web/e2e/regression.spec.ts:209](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:209); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/regression.spec.ts:211:15

[apps/web/e2e/regression.spec.ts:211](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:211); SHA-256 `5fbcd7b620b4f9da7afe671e30e139de3e97150040a34890ddbd8d8b88bf837d`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(page.getByRole("main").getByRole("alert")).toContainText(
          "couldn't check your session",
        )
```

### apps/web/e2e/regression.spec.ts:214:9

[apps/web/e2e/regression.spec.ts:214](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:214); SHA-256 `ad7352e93d8d0c05ae32f76fc14da4905b8b0b14e01c7b4656b999bc5c314e06`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(await storedTokens(page)).toEqual([
          "test-session",
          "test-refresh",
        ])
```

### apps/web/e2e/regression.spec.ts:221:15

[apps/web/e2e/regression.spec.ts:221](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:221); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression.spec.ts:222:9

[apps/web/e2e/regression.spec.ts:222](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:222); SHA-256 `4b622d08ad1aff219a806deefd795ccbb44d9f7072aed367fb3b3af9606b36d5`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(refreshes).toBe(2)
```

### apps/web/e2e/regression.spec.ts:223:9

[apps/web/e2e/regression.spec.ts:223](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:223); SHA-256 `a0e7e8448c344daec2dbab9927c7d19b712da4180aaba8b473d1a1eca967d9f7`.

Direct callback owners: PW-135, PW-136, PW-137.

All possible owners, including helper/route/hook candidates: PW-135, PW-136, PW-137.

```ts
expect(await storedTokens(page)).toEqual([
          renewedTokens.token,
          renewedTokens.refreshToken,
        ])
```

### apps/web/e2e/regression.spec.ts:247:11

[apps/web/e2e/regression.spec.ts:247](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:247); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-138.

All possible owners, including helper/route/hook candidates: PW-138.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:248:11

[apps/web/e2e/regression.spec.ts:248](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:248); SHA-256 `8223dcbb0d119cd692f66e20f3f88f0f6f4015f1199969713b605e47ae3c5f2c`.

Direct callback owners: PW-138.

All possible owners, including helper/route/hook candidates: PW-138.

```ts
expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:251:5

[apps/web/e2e/regression.spec.ts:251](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:251); SHA-256 `d8f2086013709ac48daf7f5606c3d565e532ca6b1906303cedc7b337bfd8574e`.

Direct callback owners: PW-138.

All possible owners, including helper/route/hook candidates: PW-138.

```ts
expect(await storedTokens(page)).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:252:5

[apps/web/e2e/regression.spec.ts:252](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:252); SHA-256 `c8abdd10811b6918c079df90523076c7fae134cb21dc1bc9e7f32ab489dd6646`.

Direct callback owners: PW-138.

All possible owners, including helper/route/hook candidates: PW-138.

```ts
expect(refreshes).toEqual([])
```

### apps/web/e2e/regression.spec.ts:270:11

[apps/web/e2e/regression.spec.ts:270](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:270); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-139.

All possible owners, including helper/route/hook candidates: PW-139.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:271:11

[apps/web/e2e/regression.spec.ts:271](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:271); SHA-256 `8223dcbb0d119cd692f66e20f3f88f0f6f4015f1199969713b605e47ae3c5f2c`.

Direct callback owners: PW-139.

All possible owners, including helper/route/hook candidates: PW-139.

```ts
expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:274:5

[apps/web/e2e/regression.spec.ts:274](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:274); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-139.

All possible owners, including helper/route/hook candidates: PW-139.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/regression.spec.ts:275:5

[apps/web/e2e/regression.spec.ts:275](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:275); SHA-256 `a987b119044839aa2685c7052715d291841437bc54b3af716cc796efd3f1b9e1`.

Direct callback owners: PW-139.

All possible owners, including helper/route/hook candidates: PW-139.

```ts
expect(lookups).toBe(2)
```

### apps/web/e2e/regression.spec.ts:276:5

[apps/web/e2e/regression.spec.ts:276](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:276); SHA-256 `d8f2086013709ac48daf7f5606c3d565e532ca6b1906303cedc7b337bfd8574e`.

Direct callback owners: PW-139.

All possible owners, including helper/route/hook candidates: PW-139.

```ts
expect(await storedTokens(page)).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:287:7

[apps/web/e2e/regression.spec.ts:287](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:287); SHA-256 `1ab69a83088dfa4dfd41f76bab9acd939b2c03d0594896f1acc7d1fb835f0d62`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(route.request().method()).toBe("PUT")
```

### apps/web/e2e/regression.spec.ts:292:9

[apps/web/e2e/regression.spec.ts:292](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:292); SHA-256 `e2a50708be4561929abedca9ffd6167fb39c9501a0bad6b09025954e9f162b40`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(route.request().headers().authorization).toBe(
          `Bearer ${renewedTokens.token}`,
        )
```

### apps/web/e2e/regression.spec.ts:320:11

[apps/web/e2e/regression.spec.ts:320](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:320); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:321:11

[apps/web/e2e/regression.spec.ts:321](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:321); SHA-256 `940b0de29b6ddb65ca942893c334f461cc46f59844dbf2fd4df012810be241de`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(
      page.getByRole("rowheader", { name: "Renewed Service", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:324:5

[apps/web/e2e/regression.spec.ts:324](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:324); SHA-256 `994bdd96840e4bbc304cd41cf4c5f825b505aafebaf16fb2034045783f59d8d7`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(refreshes).toBe(1)
```

### apps/web/e2e/regression.spec.ts:325:5

[apps/web/e2e/regression.spec.ts:325](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:325); SHA-256 `bf1922f69d2a021cd1d88a5f82190cf2bebea65e848c70695ae0a958088efa38`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(updates).toHaveLength(2)
```

### apps/web/e2e/regression.spec.ts:326:5

[apps/web/e2e/regression.spec.ts:326](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:326); SHA-256 `a11020223b6e99548fb720890a952ab51878da3b7554f8ef5f087f2be6f6bd2f`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(updates[1]).toEqual(updates[0])
```

### apps/web/e2e/regression.spec.ts:327:5

[apps/web/e2e/regression.spec.ts:327](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:327); SHA-256 `9fe54687999c01d9cc9b86bfba5ab42dd9bdbd83fb67a830a48570e848b12b78`.

Direct callback owners: PW-140.

All possible owners, including helper/route/hook candidates: PW-140.

```ts
expect(updates[1].name).toBe("Renewed Service")
```

### apps/web/e2e/regression.spec.ts:343:11

[apps/web/e2e/regression.spec.ts:343](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:343); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-141.

All possible owners, including helper/route/hook candidates: PW-141.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:344:5

[apps/web/e2e/regression.spec.ts:344](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:344); SHA-256 `bfe72696486336fd893dc834f7a2489223e920e32c8618e77a8f7fab1dfc7bec`.

Direct callback owners: PW-141.

All possible owners, including helper/route/hook candidates: PW-141.

```ts
expect(requests).toEqual([])
```

### apps/web/e2e/regression.spec.ts:353:13

[apps/web/e2e/regression.spec.ts:353](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:353); SHA-256 `f60552ba9a29a89a3329ed3a3f881e5d34c4aa97bbe8899c42abb6e1722ec696`.

Direct callback owners: PW-142, PW-143.

All possible owners, including helper/route/hook candidates: PW-142, PW-143.

```ts
expect(
        page.getByLabel("Email address", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:356:13

[apps/web/e2e/regression.spec.ts:356](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:356); SHA-256 `f8c45b7939835716c011bb1c16e66906c1d76de69ed079e4f54cc913ce0473da`.

Direct callback owners: PW-142, PW-143.

All possible owners, including helper/route/hook candidates: PW-142, PW-143.

```ts
expect(
        page.getByRole("button", { name: /google|facebook|apple/i }),
      ).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:359:13

[apps/web/e2e/regression.spec.ts:359](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:359); SHA-256 `e26a3e923bd7efe854ced7556eb3c7080a637948d18c190ec64d61e2240a06c8`.

Direct callback owners: PW-142, PW-143.

All possible owners, including helper/route/hook candidates: PW-142, PW-143.

```ts
expect(
        page.getByRole("link", { name: /google|facebook|apple/i }),
      ).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:373:7

[apps/web/e2e/regression.spec.ts:373](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:373); SHA-256 `260836517f0aaeadd6237cd7f617610493d704cb047acdde6786964488cd6a15`.

Direct callback owners: PW-144.

All possible owners, including helper/route/hook candidates: PW-144.

```ts
expect(response.status()).toBe(200)
```

### apps/web/e2e/regression.spec.ts:374:7

[apps/web/e2e/regression.spec.ts:374](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:374); SHA-256 `e82cc47e86ca20e3a3b21657f3c314d598577205a87eda09b24067e28817b0d0`.

Direct callback owners: PW-144.

All possible owners, including helper/route/hook candidates: PW-144.

```ts
expect(await response.text()).toContain(title)
```

### apps/web/e2e/regression.spec.ts:377:5

[apps/web/e2e/regression.spec.ts:377](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:377); SHA-256 `cda337f897daefab19b24ca260c1298cbbf350da62f508b385350cecac226772`.

Direct callback owners: PW-144.

All possible owners, including helper/route/hook candidates: PW-144.

```ts
expect(missing.status()).toBe(404)
```

### apps/web/e2e/regression.spec.ts:378:5

[apps/web/e2e/regression.spec.ts:378](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:378); SHA-256 `8e62f8912483d3e5ee58911a580617ee78744ab126142dd847eb2cc7eb6d181a`.

Direct callback owners: PW-144.

All possible owners, including helper/route/hook candidates: PW-144.

```ts
expect(await missing.text()).toContain("Page not found")
```

### apps/web/e2e/regression.spec.ts:394:13

[apps/web/e2e/regression.spec.ts:394](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:394); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-145.

All possible owners, including helper/route/hook candidates: PW-145.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:395:13

[apps/web/e2e/regression.spec.ts:395](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:395); SHA-256 `eb3da1dea3dd0357afb82894798f40adf41cb7400d0dc3f142e1dcdbc993c031`.

Direct callback owners: PW-145.

All possible owners, including helper/route/hook candidates: PW-145.

```ts
expect(
        page.getByRole("heading", { name: "Welcome Back" }),
      ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:411:11

[apps/web/e2e/regression.spec.ts:411](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:411); SHA-256 `9a446a6aef06245c6479581d2eabe1510e7b7587f64e86eea9e16905be07b63d`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      page.getByRole("status", { name: "Opening your account" }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:414:11

[apps/web/e2e/regression.spec.ts:414](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:414); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression.spec.ts:415:11

[apps/web/e2e/regression.spec.ts:415](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:415); SHA-256 `b4709b4671fb711d07d5551bfa24007b8cd11686e85bbed4ed5f74f4bb7a43c1`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      page.getByRole("status", { name: "Opening your account" }),
    ).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:418:5

[apps/web/e2e/regression.spec.ts:418](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:418); SHA-256 `7b6dfd775d1e502712f66a2d80488e4b649ea76edbc791b8bc670fe4cfc061ad`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("test-session")
```

### apps/web/e2e/regression.spec.ts:421:5

[apps/web/e2e/regression.spec.ts:421](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:421); SHA-256 `af515837cbf3716e23173d5b87dc690b864985463ba88695e1f46e15b545ed8e`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/regression.spec.ts:424:5

[apps/web/e2e/regression.spec.ts:424](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:424); SHA-256 `b1a3d72a206eb68cfc1f9ee69b221548d712b6ac632c6ff0ccf2e2e425f157bc`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.value === "test-session",
      ),
    ).toBe(false)
```

### apps/web/e2e/regression.spec.ts:429:11

[apps/web/e2e/regression.spec.ts:429](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:429); SHA-256 `9c5ac2d5af1cde81f9a8b1916d35feaad5310b3005fdb2e1ad9f2f10a568f4dc`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(page.getByText("Welcome back", { exact: true })).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:430:5

[apps/web/e2e/regression.spec.ts:430](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:430); SHA-256 `47b1776559c458699f70191fd502a651136821430ede0ed39a1c504022dffaac`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
```

### apps/web/e2e/regression.spec.ts:431:5

[apps/web/e2e/regression.spec.ts:431](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:431); SHA-256 `aeb18e0f18f3beb8c72aeaa92a8c26ea44020a2084b4fcdcc4753dbaf5f6b8ed`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      await page.evaluate(() =>
        localStorage.getItem("nexus.auth.refreshToken"),
      ),
    ).toBeNull()
```

### apps/web/e2e/regression.spec.ts:437:11

[apps/web/e2e/regression.spec.ts:437](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:437); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:438:5

[apps/web/e2e/regression.spec.ts:438](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:438); SHA-256 `d8f2086013709ac48daf7f5606c3d565e532ca6b1906303cedc7b337bfd8574e`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(await storedTokens(page)).toEqual([null, null])
```

### apps/web/e2e/regression.spec.ts:439:5

[apps/web/e2e/regression.spec.ts:439](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:439); SHA-256 `9fb3ca2eef5efa5b42efeee7e866c743df64e5f6eaa7603ae4fb3b431f519ca5`.

Direct callback owners: PW-146.

All possible owners, including helper/route/hook candidates: PW-146.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/regression.spec.ts:456:11

[apps/web/e2e/regression.spec.ts:456](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:456); SHA-256 `332faca35007dbba8b699f6e9e5fdeb8b637f147ee23b314ae9507d3d223f853`.

Direct callback owners: PW-147.

All possible owners, including helper/route/hook candidates: PW-147.

```ts
expect(page.getByText("Sign-in failed")).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:457:11

[apps/web/e2e/regression.spec.ts:457](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:457); SHA-256 `69e48cd3bb946722bca7725c0a3ffbcd0e6e4c3ac0881764c26b4cbdf9e98f2b`.

Direct callback owners: PW-147.

All possible owners, including helper/route/hook candidates: PW-147.

```ts
expect(
      page.getByText("Email or password is incorrect. Please try again."),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:461:11

[apps/web/e2e/regression.spec.ts:461](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:461); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-147.

All possible owners, including helper/route/hook candidates: PW-147.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:462:11

[apps/web/e2e/regression.spec.ts:462](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:462); SHA-256 `f9ea4bc36bc1a3de7c7d8704f544cb87d89e63f6707eed56bf33400f5b846bc4`.

Direct callback owners: PW-147.

All possible owners, including helper/route/hook candidates: PW-147.

```ts
expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
      "invalid@example.com",
    )
```

### apps/web/e2e/regression.spec.ts:465:5

[apps/web/e2e/regression.spec.ts:465](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:465); SHA-256 `9fb3ca2eef5efa5b42efeee7e866c743df64e5f6eaa7603ae4fb3b431f519ca5`.

Direct callback owners: PW-147.

All possible owners, including helper/route/hook candidates: PW-147.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/regression.spec.ts:487:11

[apps/web/e2e/regression.spec.ts:487](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:487); SHA-256 `001eb699917fd2634518b1d4c1d9ff89395e517320618b1083cb84ba7517aab9`.

Direct callback owners: PW-148.

All possible owners, including helper/route/hook candidates: PW-148.

```ts
expect(
      page.getByText("Name must be 2 to 100 characters."),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:490:11

[apps/web/e2e/regression.spec.ts:490](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:490); SHA-256 `5a2f10099c0fa5acbae629df5ea6b7e82a577b892ceaa830f62218ff8eff8a1e`.

Direct callback owners: PW-148.

All possible owners, including helper/route/hook candidates: PW-148.

```ts
expect(page).toHaveURL(/\/register$/)
```

### apps/web/e2e/regression.spec.ts:514:11

[apps/web/e2e/regression.spec.ts:514](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:514); SHA-256 `46e0184f06fa59230f539157ea8f89c653ddfa90c22cfb80c7442f081114dbf9`.

Direct callback owners: PW-149.

All possible owners, including helper/route/hook candidates: PW-149.

```ts
expect(
      page.getByRole("alert").filter({
        hasText: "This email is already registered. Sign in instead.",
      }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:519:11

[apps/web/e2e/regression.spec.ts:519](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:519); SHA-256 `5a2f10099c0fa5acbae629df5ea6b7e82a577b892ceaa830f62218ff8eff8a1e`.

Direct callback owners: PW-149.

All possible owners, including helper/route/hook candidates: PW-149.

```ts
expect(page).toHaveURL(/\/register$/)
```

### apps/web/e2e/regression.spec.ts:540:5

[apps/web/e2e/regression.spec.ts:540](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:540); SHA-256 `7697f1b8717a28c293cc1cc2139a45bb605497ca149c36bbef7534f3f6d3ce33`.

Direct callback owners: PW-150.

All possible owners, including helper/route/hook candidates: PW-150.

```ts
expect((await submitted).postDataJSON()).toEqual({
      fullName: "Test Person",
      contactNumber: "09123456789",
      email: testAccounts.USER.email,
      password: "CorrectHorse123!",
    })
```

### apps/web/e2e/regression.spec.ts:546:11

[apps/web/e2e/regression.spec.ts:546](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:546); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-150.

All possible owners, including helper/route/hook candidates: PW-150.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression.spec.ts:547:11

[apps/web/e2e/regression.spec.ts:547](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:547); SHA-256 `6c0043c4c4ee437a3b98e10d222a0c0b5cc99a0bbb93d28da3c9bc3e73332197`.

Direct callback owners: PW-150.

All possible owners, including helper/route/hook candidates: PW-150.

```ts
expect(page.locator('[data-role="USER"]')).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:548:5

[apps/web/e2e/regression.spec.ts:548](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:548); SHA-256 `47b1776559c458699f70191fd502a651136821430ede0ed39a1c504022dffaac`.

Direct callback owners: PW-150.

All possible owners, including helper/route/hook candidates: PW-150.

```ts
expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
```

### apps/web/e2e/regression.spec.ts:549:11

[apps/web/e2e/regression.spec.ts:549](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:549); SHA-256 `b4709b4671fb711d07d5551bfa24007b8cd11686e85bbed4ed5f74f4bb7a43c1`.

Direct callback owners: PW-150.

All possible owners, including helper/route/hook candidates: PW-150.

```ts
expect(
      page.getByRole("status", { name: "Opening your account" }),
    ).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:561:11

[apps/web/e2e/regression.spec.ts:561](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:561); SHA-256 `3c36b53c991b1399ad840f18cc361e65d11101d70eb97ca0b9c243eae447a610`.

Direct callback owners: PW-151.

All possible owners, including helper/route/hook candidates: PW-151.

```ts
expect(page.locator('main[lang="fil"]')).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:563:11

[apps/web/e2e/regression.spec.ts:563](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:563); SHA-256 `5a2f10099c0fa5acbae629df5ea6b7e82a577b892ceaa830f62218ff8eff8a1e`.

Direct callback owners: PW-151.

All possible owners, including helper/route/hook candidates: PW-151.

```ts
expect(page).toHaveURL(/\/register$/)
```

### apps/web/e2e/regression.spec.ts:564:11

[apps/web/e2e/regression.spec.ts:564](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:564); SHA-256 `3c36b53c991b1399ad840f18cc361e65d11101d70eb97ca0b9c243eae447a610`.

Direct callback owners: PW-151.

All possible owners, including helper/route/hook candidates: PW-151.

```ts
expect(page.locator('main[lang="fil"]')).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:584:15

[apps/web/e2e/regression.spec.ts:584](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:584); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-152, PW-153, PW-154, PW-155.

All possible owners, including helper/route/hook candidates: PW-152, PW-153, PW-154, PW-155.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression.spec.ts:585:9

[apps/web/e2e/regression.spec.ts:585](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:585); SHA-256 `dee2f193b0c79aa70b174f2451cfcc5845de679dcb1428ecde7b6b9ad97dbb8d`.

Direct callback owners: PW-152, PW-153, PW-154, PW-155.

All possible owners, including helper/route/hook candidates: PW-152, PW-153, PW-154, PW-155.

```ts
expect(
          await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
        ).toBe("test-session")
```

### apps/web/e2e/regression.spec.ts:588:15

[apps/web/e2e/regression.spec.ts:588](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:588); SHA-256 `5008e757abe7923fa5092dad3f52d4060852907d454bdce42962dc8da6cf65cf`.

Direct callback owners: PW-152, PW-153, PW-154, PW-155.

All possible owners, including helper/route/hook candidates: PW-152, PW-153, PW-154, PW-155.

```ts
expect(
          page.getByRole("button", { name: "Sign In", exact: true }),
        ).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:592:7

[apps/web/e2e/regression.spec.ts:592](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:592); SHA-256 `9917c810d8e2d2b136502b68f13a6c8750b844630587e33b074fe0e6593406b7`.

Direct callback owners: PW-152, PW-153, PW-154, PW-155.

All possible owners, including helper/route/hook candidates: PW-152, PW-153, PW-154, PW-155.

```ts
expect(authWrites).toEqual([])
```

### apps/web/e2e/regression.spec.ts:606:11

[apps/web/e2e/regression.spec.ts:606](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:606); SHA-256 `8223dcbb0d119cd692f66e20f3f88f0f6f4015f1199969713b605e47ae3c5f2c`.

Direct callback owners: PW-156.

All possible owners, including helper/route/hook candidates: PW-156.

```ts
expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/regression.spec.ts:609:5

[apps/web/e2e/regression.spec.ts:609](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:609); SHA-256 `9fb3ca2eef5efa5b42efeee7e866c743df64e5f6eaa7603ae4fb3b431f519ca5`.

Direct callback owners: PW-156.

All possible owners, including helper/route/hook candidates: PW-156.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/regression.spec.ts:625:11

[apps/web/e2e/regression.spec.ts:625](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:625); SHA-256 `4e536dfaf88263cce458f2cb35181abd86ff953c72253b1d656101ee73046dc4`.

Direct callback owners: PW-157.

All possible owners, including helper/route/hook candidates: PW-157.

```ts
expect(page.getByRole("main").getByRole("alert")).toContainText(
      "couldn't check your session",
    )
```

### apps/web/e2e/regression.spec.ts:628:5

[apps/web/e2e/regression.spec.ts:628](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:628); SHA-256 `7b6dfd775d1e502712f66a2d80488e4b649ea76edbc791b8bc670fe4cfc061ad`.

Direct callback owners: PW-157.

All possible owners, including helper/route/hook candidates: PW-157.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("test-session")
```

### apps/web/e2e/regression.spec.ts:631:11

[apps/web/e2e/regression.spec.ts:631](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:631); SHA-256 `cf98676269ffc3e1c172a19d4df5f56428cfd128c6d15c2a10cdd008389229d8`.

Direct callback owners: PW-157.

All possible owners, including helper/route/hook candidates: PW-157.

```ts
expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/regression.spec.ts:636:11

[apps/web/e2e/regression.spec.ts:636](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:636); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-157.

All possible owners, including helper/route/hook candidates: PW-157.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/regression.spec.ts:637:5

[apps/web/e2e/regression.spec.ts:637](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:637); SHA-256 `7b6dfd775d1e502712f66a2d80488e4b649ea76edbc791b8bc670fe4cfc061ad`.

Direct callback owners: PW-157.

All possible owners, including helper/route/hook candidates: PW-157.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("test-session")
```

### apps/web/e2e/regression.spec.ts:655:11

[apps/web/e2e/regression.spec.ts:655](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:655); SHA-256 `b68d1de2ab7fad5546a636cf5ad83edf8a836e0e8f2e10f430a0727c46434ef9`.

Direct callback owners: PW-158.

All possible owners, including helper/route/hook candidates: PW-158.

```ts
expect(page).toHaveURL(/\/login$/)
```

### apps/web/e2e/regression.spec.ts:656:5

[apps/web/e2e/regression.spec.ts:656](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:656); SHA-256 `9fb3ca2eef5efa5b42efeee7e866c743df64e5f6eaa7603ae4fb3b431f519ca5`.

Direct callback owners: PW-158.

All possible owners, including helper/route/hook candidates: PW-158.

```ts
expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

## apps/web/e2e/request-conversations.spec.ts

### apps/web/e2e/request-conversations.spec.ts:77:5

[apps/web/e2e/request-conversations.spec.ts:77](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:77); SHA-256 `6e1ad7cef0ee4e1e8a511617cff47206910a08821af7440ed8d288baebf793d6`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-159, PW-160, PW-161, PW-162, PW-163, PW-164, PW-165, PW-166, PW-167, PW-168, PW-169, PW-170, PW-171, PW-172, PW-173, PW-174, PW-175, PW-176, PW-177, PW-178, PW-179, PW-180, PW-181, PW-182, PW-183, PW-184, PW-185, PW-186, PW-187, PW-188, PW-189, PW-190, PW-191, PW-192, PW-193, PW-194, PW-195, PW-196, PW-197, PW-198, PW-199, PW-200, PW-201, PW-202, PW-203, PW-204.

```ts
expect(request.headers().authorization).toBe("Bearer conversation-session")
```

### apps/web/e2e/request-conversations.spec.ts:479:9

[apps/web/e2e/request-conversations.spec.ts:479](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:479); SHA-256 `cc444a850544df34242f693b5a1de3bb3a6e276a3e70c1ad716c36c1243dcee0`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-168, PW-169, PW-170, PW-171, PW-172, PW-173.

```ts
expect(
    page.getByRole("dialog", { name: "Booking details" }),
  ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:482:9

[apps/web/e2e/request-conversations.spec.ts:482](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:482); SHA-256 `b693b4814193fc303bdc54b8321907365347409d51da304065a7bd0fb9de2047`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-168, PW-169, PW-170, PW-171, PW-172, PW-173.

```ts
expect(
    page.getByRole("region", { name: "Request conversation" }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:492:9

[apps/web/e2e/request-conversations.spec.ts:492](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:492); SHA-256 `bb311cfac76d748b265b645134f8789d2178c4892d2f42c9600a0a50b72b4b0d`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-168, PW-169, PW-170, PW-171, PW-172, PW-173.

```ts
expect(page).toHaveURL(/\/messages\?request=booking-1$/)
```

### apps/web/e2e/request-conversations.spec.ts:493:9

[apps/web/e2e/request-conversations.spec.ts:493](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:493); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-168, PW-169, PW-170, PW-171, PW-172, PW-173.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:515:9

[apps/web/e2e/request-conversations.spec.ts:515](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:515); SHA-256 `c61d6be666380981047dd9ee6a13a2d048eb226943eb7e1cfae745f3d331f455`.

Direct callback owners: PW-159.

All possible owners, including helper/route/hook candidates: PW-159.

```ts
expect
    .poll(() => bookingIds.map((id) => reads.get(id)))
    .toEqual([1, 1, 1])
```

### apps/web/e2e/request-conversations.spec.ts:518:9

[apps/web/e2e/request-conversations.spec.ts:518](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:518); SHA-256 `84de62b71db2a74108844076e387c7a0f9c63db711a39aba40944a0d94c4922d`.

Direct callback owners: PW-159.

All possible owners, including helper/route/hook candidates: PW-159.

```ts
expect(
    page.getByRole("complementary", { name: "Request context" }),
  ).toContainText("SR-101")
```

### apps/web/e2e/request-conversations.spec.ts:522:9

[apps/web/e2e/request-conversations.spec.ts:522](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:522); SHA-256 `cc34c4a52d17f2d1f708c408ce2d9ee70b37e34045deeb0c30a35bc05ca37caa`.

Direct callback owners: PW-159.

All possible owners, including helper/route/hook candidates: PW-159.

```ts
expect
    .poll(() => bookingIds.map((id) => reads.get(id)))
    .toEqual([2, 2, 2])
```

### apps/web/e2e/request-conversations.spec.ts:525:9

[apps/web/e2e/request-conversations.spec.ts:525](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:525); SHA-256 `9df895eb8a6e9c7bd6d11a6581a7eb9ed266ca41a9dd05ac21b175178b04a8f6`.

Direct callback owners: PW-159.

All possible owners, including helper/route/hook candidates: PW-159.

```ts
expect(
    page.getByText("Couldn't load workflow", { exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:631:11

[apps/web/e2e/request-conversations.spec.ts:631](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:631); SHA-256 `4e4cfecc38bd33638723c14a104a82d8e257ff82a93ba6b8e52a6e8aacf7aaf5`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(openProfile).toBeEnabled({ timeout: 30000 })
```

### apps/web/e2e/request-conversations.spec.ts:632:11

[apps/web/e2e/request-conversations.spec.ts:632](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:632); SHA-256 `9dbc1d92f910d805ef3d1350f7c2037e5bfb96ab6a90a8fb0379772dc51af9e1`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      page
        .getByRole("region", { name: "Request conversation" })
        .locator("header img"),
    ).toHaveAttribute("src", imageUrl)
```

### apps/web/e2e/request-conversations.spec.ts:637:11

[apps/web/e2e/request-conversations.spec.ts:637](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:637); SHA-256 `37ffb839b0568c035861c430292ff0172b0ee03ae561c9ecd866a2ee0897c08a`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect
      .poll(() =>
        page
          .getByRole("region", { name: "Request conversation" })
          .locator("header img")
          .evaluate((image) => {
            const bounds = image.getBoundingClientRect()
            return Math.abs(bounds.width - bounds.height)
          }),
      )
      .toBeLessThan(1)
```

### apps/web/e2e/request-conversations.spec.ts:649:13

[apps/web/e2e/request-conversations.spec.ts:649](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:649); SHA-256 `81daa87f78c0b14733cf85285cd6da6f0f67e2869e2cb486d599487fb7f5bdf7`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
        page
          .getByRole("navigation", { name: "Conversations", exact: true })
          .locator("img")
          .first(),
      ).toHaveAttribute("src", imageUrl)
```

### apps/web/e2e/request-conversations.spec.ts:660:11

[apps/web/e2e/request-conversations.spec.ts:660](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:660); SHA-256 `ac7306835eb13bf525611b6c8ab084c8eeef9959b39283e7ddf27e944ad12641`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByRole("heading", { name: "Dani Updated", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:663:11

[apps/web/e2e/request-conversations.spec.ts:663](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:663); SHA-256 `c41a363603d85d729147c16e690ba45f90be59c49035da79a37ec6b8374d998c`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByText("My latest published biography."),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:666:11

[apps/web/e2e/request-conversations.spec.ts:666](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:666); SHA-256 `8be34b6973978ab8aa8c6fec92b75f95e212aa03ca3ee5d19825a43121bc162f`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByText("Accessible design", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:669:11

[apps/web/e2e/request-conversations.spec.ts:669](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:669); SHA-256 `5eff5ef5cc06355bb40f78160244644d8a80dda5459309aa3868d89c8e6d3148`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByRole("link", { name: /Open LinkedIn/ }),
    ).toHaveAttribute("href", "https://linkedin.com/in/dani")
```

### apps/web/e2e/request-conversations.spec.ts:672:11

[apps/web/e2e/request-conversations.spec.ts:672](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:672); SHA-256 `449148f7f563ac44da4f2d36cb33b17d1f7d6d15be9cd1930d6125e48b898050`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(dialog.locator(`img[src="${imageUrl}"]`).first()).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:673:11

[apps/web/e2e/request-conversations.spec.ts:673](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:673); SHA-256 `5ea4dfc17cd9bcc8cf298f1fc70b04b6d0f9f2c460f7181410a042ff164331f5`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect
      .poll(() =>
        dialog
          .locator(`img[src="${imageUrl}"]`)
          .first()
          .evaluate((image) => (image as HTMLImageElement).complete),
      )
      .toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:681:5

[apps/web/e2e/request-conversations.spec.ts:681](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:681); SHA-256 `1c96d618df6d42a4c90d99e08fe29a1a04133877940d16568f6527fe11109eb4`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(imageSizingWarnings).toEqual([])
```

### apps/web/e2e/request-conversations.spec.ts:688:11

[apps/web/e2e/request-conversations.spec.ts:688](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:688); SHA-256 `9838179fc1bd9f4b50f0e6b3fb28ff3d35c00bbe44de24561dc6c8af0bf15f93`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByRole("heading", { name: "Published website", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:691:11

[apps/web/e2e/request-conversations.spec.ts:691](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:691); SHA-256 `36d9d265d9364470023f24f0b067a1c280a3d4f3d173d13e64df0c18b744e121`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByText("Design and development", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:694:11

[apps/web/e2e/request-conversations.spec.ts:694](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:694); SHA-256 `b8076fbaee4f97d86eba225353adbc4fc59b7ae76c6464102cf9f105fdd92d56`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByRole("img", { name: "Published website", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:697:5

[apps/web/e2e/request-conversations.spec.ts:697](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:697); SHA-256 `1c96d618df6d42a4c90d99e08fe29a1a04133877940d16568f6527fe11109eb4`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(imageSizingWarnings).toEqual([])
```

### apps/web/e2e/request-conversations.spec.ts:701:11

[apps/web/e2e/request-conversations.spec.ts:701](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:701); SHA-256 `8bd6c81b0ec32af28879149d54915d35042bb00fe164d5dffdd8cc7af1950eaa`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(dialog).not.toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:704:11

[apps/web/e2e/request-conversations.spec.ts:704](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:704); SHA-256 `a962c554abafb676abd9c60eb12078d7bd82a165c88364f35eaa4b2ca90f1fa9`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect(
      dialog.getByText("An updated biography after reopening."),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:707:11

[apps/web/e2e/request-conversations.spec.ts:707](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:707); SHA-256 `acf0a708745109fde4deb31fd78928a98945daa16ab736915873a4c92575dbb3`.

Direct callback owners: PW-160, PW-161.

All possible owners, including helper/route/hook candidates: PW-160, PW-161.

```ts
expect
      .poll(() =>
        dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
      )
      .toBeLessThanOrEqual(0)
```

### apps/web/e2e/request-conversations.spec.ts:724:11

[apps/web/e2e/request-conversations.spec.ts:724](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:724); SHA-256 `c23d41a3927767ef147aa1c5c03164b3abda1fb0c6eb575aeba33edc96193035`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(page).toHaveURL(/\/messages$/)
```

### apps/web/e2e/request-conversations.spec.ts:732:11

[apps/web/e2e/request-conversations.spec.ts:732](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:732); SHA-256 `bb311cfac76d748b265b645134f8789d2178c4892d2f42c9600a0a50b72b4b0d`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(page).toHaveURL(/\/messages\?request=booking-1$/)
```

### apps/web/e2e/request-conversations.spec.ts:733:11

[apps/web/e2e/request-conversations.spec.ts:733](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:733); SHA-256 `c69905d9e6e19f43d816d6698c0169290f2fae5e82524295cb55853bf4f44346`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(page.getByLabel("Message", { exact: true })).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:734:11

[apps/web/e2e/request-conversations.spec.ts:734](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:734); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:736:13

[apps/web/e2e/request-conversations.spec.ts:736](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:736); SHA-256 `cf5213c5f0780119866aa8f4922b4607c5765f757ccc19c3409c8aa510911a77`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(conversations).not.toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:738:13

[apps/web/e2e/request-conversations.spec.ts:738](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:738); SHA-256 `ad65498c66bc2347e97b2616b1d7b429d1c6584d884e84c8c07c36b3c8c91340`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(conversations).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:739:13

[apps/web/e2e/request-conversations.spec.ts:739](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:739); SHA-256 `c23d41a3927767ef147aa1c5c03164b3abda1fb0c6eb575aeba33edc96193035`.

Direct callback owners: PW-162, PW-163.

All possible owners, including helper/route/hook candidates: PW-162, PW-163.

```ts
expect(page).toHaveURL(/\/messages$/)
```

### apps/web/e2e/request-conversations.spec.ts:751:9

[apps/web/e2e/request-conversations.spec.ts:751](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:751); SHA-256 `07fb6b1db6b3f8e9731566ee880e607a61a3f1311c3a40f3a8e9d9506ccdc7dd`.

Direct callback owners: PW-164.

All possible owners, including helper/route/hook candidates: PW-164.

```ts
expect(
    page.getByText("Couldn't load conversations.", { exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:754:9

[apps/web/e2e/request-conversations.spec.ts:754](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:754); SHA-256 `fb64b6cd65ce7968a16382714c1a4b214691cd934c181c42ca5dd5887441d3fa`.

Direct callback owners: PW-164.

All possible owners, including helper/route/hook candidates: PW-164.

```ts
expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("alert"),
  ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:759:9

[apps/web/e2e/request-conversations.spec.ts:759](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:759); SHA-256 `512f05d4af8c422e80e583a31cd6b31e43029250630a2bf06f9a7ec371e649bc`.

Direct callback owners: PW-164.

All possible owners, including helper/route/hook candidates: PW-164.

```ts
expect(
    page.getByRole("heading", { name: "No conversations yet" }),
  ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:764:9

[apps/web/e2e/request-conversations.spec.ts:764](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:764); SHA-256 `4a08dd8d48aec35993ef84f4c4832af630dc3381eca5fafe4e465b5e254c7652`.

Direct callback owners: PW-164.

All possible owners, including helper/route/hook candidates: PW-164.

```ts
expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("link"),
  ).toHaveCount(1)
```

### apps/web/e2e/request-conversations.spec.ts:778:7

[apps/web/e2e/request-conversations.spec.ts:778](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:778); SHA-256 `4dabfce2f473484a117ebf7c5a87fca770125fbf5fbf5dc7fdf4f7825d5ff4bf`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(route.request().headers().authorization).toBe(
        "Bearer conversation-session",
      )
```

### apps/web/e2e/request-conversations.spec.ts:781:7

[apps/web/e2e/request-conversations.spec.ts:781](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:781); SHA-256 `ed72c572e99c20b0292afb3ccf20bd1676a6cf71ecc107a344f2ee6b28505e99`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(route.request().method()).toBe("GET")
```

### apps/web/e2e/request-conversations.spec.ts:790:11

[apps/web/e2e/request-conversations.spec.ts:790](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:790); SHA-256 `c23d41a3927767ef147aa1c5c03164b3abda1fb0c6eb575aeba33edc96193035`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(page).toHaveURL(/\/messages$/)
```

### apps/web/e2e/request-conversations.spec.ts:791:11

[apps/web/e2e/request-conversations.spec.ts:791](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:791); SHA-256 `5de5fe701ec49b5ee88c52172cabac2c136e86339c819849c523a895075842b5`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(
      page.getByRole("link", { name: "Messages", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:794:11

[apps/web/e2e/request-conversations.spec.ts:794](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:794); SHA-256 `651d976205a21f285d7c5782e276c7b55bed74a24ee78e9fb0b430048ec8ab92`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(
      page.getByRole("heading", { name: "No conversations yet", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:797:5

[apps/web/e2e/request-conversations.spec.ts:797](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:797); SHA-256 `487c81d21ad5a35668dadca6aa97101fe8d2c8cff020e3838779b98c138d92e7`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(state.listReads).toBeGreaterThan(0)
```

### apps/web/e2e/request-conversations.spec.ts:801:11

[apps/web/e2e/request-conversations.spec.ts:801](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:801); SHA-256 `b1a4f002e818ae6bdbab9bf11a2ada7494ba3ae166f0b42c01d7e7209c6c2512`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(page).toHaveURL(/\/messages\?mode=internal$/)
```

### apps/web/e2e/request-conversations.spec.ts:802:11

[apps/web/e2e/request-conversations.spec.ts:802](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:802); SHA-256 `fe22fd8cbcfa2e8b50078703bb5db1f89924d4e078b3f4113ca4348005befcf2`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect.poll(() => internalReads).toBeGreaterThan(0)
```

### apps/web/e2e/request-conversations.spec.ts:803:11

[apps/web/e2e/request-conversations.spec.ts:803](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:803); SHA-256 `45697d3f4cfab25355b59d231f3f338ac2864bde772218a08db83a97e2508506`.

Direct callback owners: PW-165, PW-166, PW-167.

All possible owners, including helper/route/hook candidates: PW-165, PW-166, PW-167.

```ts
expect(
      page
        .getByRole("navigation", { name: "Conversations", exact: true })
        .getByRole("link", { name: "Back to client chats", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:823:11

[apps/web/e2e/request-conversations.spec.ts:823](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:823); SHA-256 `398e52c2f85344d321db8be9ec0e82144ada543c70798332a99418c380aff08a`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(
      client.getByText(/Messaging opens when a department head/),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:833:11

[apps/web/e2e/request-conversations.spec.ts:833](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:833); SHA-256 `bb311cfac76d748b265b645134f8789d2178c4892d2f42c9600a0a50b72b4b0d`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(page).toHaveURL(/\/messages\?request=booking-1$/)
```

### apps/web/e2e/request-conversations.spec.ts:838:11

[apps/web/e2e/request-conversations.spec.ts:838](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:838); SHA-256 `4932f31440c0234f23e7ea43bd9eca0ef2c5285a5bb8432770b1c3fd6445e780`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(headChat.getByLabel("Message", { exact: true })).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:839:11

[apps/web/e2e/request-conversations.spec.ts:839](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:839); SHA-256 `85c928366d4c61385c03ab25fddd48e33c17ee6b9c4be3d81edac1acbf82ce93`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(
      clientChat.getByLabel("Message", { exact: true }),
    ).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:848:11

[apps/web/e2e/request-conversations.spec.ts:848](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:848); SHA-256 `7b0ad576da5decebd7bd978bb470bfaf713835a73c0758bf675553d98f57cd95`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(clientChat.getByText(text, { exact: true })).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:855:11

[apps/web/e2e/request-conversations.spec.ts:855](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:855); SHA-256 `6da890c8376b1d14229c7073c04f59b7e0843216f8bc1bb15116f3167cdd96e2`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(
      headChat.getByText("Thanks, Dani. I’ll share the details here."),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:858:5

[apps/web/e2e/request-conversations.spec.ts:858](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:858); SHA-256 `df262c2c9282c60cb901ed320a13fd75b8e553f321d396daaeda31989dabfb8d`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(state.messages).toHaveLength(2)
```

### apps/web/e2e/request-conversations.spec.ts:860:13

[apps/web/e2e/request-conversations.spec.ts:860](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:860); SHA-256 `55e6187c73725f27d92806ab7dd9a98ddad0fbf6a68328fb674554a3d552224a`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(
        page.getByRole("navigation", { name: "Conversations" }),
      ).toContainText("Thanks, Dani. I’ll share the details here.")
```

### apps/web/e2e/request-conversations.spec.ts:868:5

[apps/web/e2e/request-conversations.spec.ts:868](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:868); SHA-256 `a467e36b00a7e3dbba9014e6e2cb62b4ed4185a0817c060de32ff107d7dcd6c6`.

Direct callback owners: PW-168, PW-169.

All possible owners, including helper/route/hook candidates: PW-168, PW-169.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:889:9

[apps/web/e2e/request-conversations.spec.ts:889](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:889); SHA-256 `bba9fe75491d0f00082a3985f8b102f96c5ffee7c7ed2300dde0a4d0be268429`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(
    page.getByText("Connection interrupted. Try again.", { exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:892:9

[apps/web/e2e/request-conversations.spec.ts:892](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:892); SHA-256 `ce3321b7b75cf23f4cadccd2d431b3d0c5919d310ae126da5b6bc86aec7f8a75`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(chat.getByRole("alert")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:893:9

[apps/web/e2e/request-conversations.spec.ts:893](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:893); SHA-256 `6d99f7a8d71cb2a6f9117cf4bf064f53e671f27eb3e9630ea640e7978f66ed7c`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(chat.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep this draft if the connection fails.",
  )
```

### apps/web/e2e/request-conversations.spec.ts:897:9

[apps/web/e2e/request-conversations.spec.ts:897](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:897); SHA-256 `8139b73fad90221661d70dda58ad848d421ef2af6910e28a430c05e1fee6d2d6`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(chat.getByLabel("Message", { exact: true })).toHaveValue("")
```

### apps/web/e2e/request-conversations.spec.ts:898:3

[apps/web/e2e/request-conversations.spec.ts:898](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:898); SHA-256 `1bd440539fbe91c01d6a796fe0dd939a248b6d8ed30d2f69050456398c9d5a8e`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(state.ids).toHaveLength(2)
```

### apps/web/e2e/request-conversations.spec.ts:899:3

[apps/web/e2e/request-conversations.spec.ts:899](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:899); SHA-256 `9d0e63a56d50d48e40f453d89422a601b55d2f010d85a3c91b7a5ea6f1183e40`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(state.ids[0]).toBe(state.ids[1])
```

### apps/web/e2e/request-conversations.spec.ts:900:3

[apps/web/e2e/request-conversations.spec.ts:900](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:900); SHA-256 `77e4e16ad906e468bba18fa6f39dcb49a79225fb8d9eee3e3247df4b2f0bd069`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(state.messages).toHaveLength(1)
```

### apps/web/e2e/request-conversations.spec.ts:901:9

[apps/web/e2e/request-conversations.spec.ts:901](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:901); SHA-256 `5728aaf3b61dd258278416ce2e352a9266b52c4ad9cc16be3a47aaba854589f0`.

Direct callback owners: PW-170.

All possible owners, including helper/route/hook candidates: PW-170.

```ts
expect(chat.getByRole("article")).toHaveCount(1)
```

### apps/web/e2e/request-conversations.spec.ts:929:9

[apps/web/e2e/request-conversations.spec.ts:929](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:929); SHA-256 `f9d0c4a56b2bc8ef423561fbab41bf895383bac111fc3cb8ea74913b405c66b3`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(route.request().headers().authorization).toBe(
          "Bearer conversation-session",
        )
```

### apps/web/e2e/request-conversations.spec.ts:932:9

[apps/web/e2e/request-conversations.spec.ts:932](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:932); SHA-256 `25cb51a9814791ae6a5c035a4c4e14f8f7b28fb92806e295584510df4b46590a`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(["PATCH", "DELETE"]).toContain(method)
```

### apps/web/e2e/request-conversations.spec.ts:962:11

[apps/web/e2e/request-conversations.spec.ts:962](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:962); SHA-256 `4e9250eedcbb7fe6506bbe1ab1c6dd2f3b5fccfb93758e8707978d28923d7cc3`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(
      clientChat.getByRole("button", { name: /Actions for your message/ }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:974:11

[apps/web/e2e/request-conversations.spec.ts:974](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:974); SHA-256 `79a5922e68d3483d5c978499f176578405f9ad8726c36b78b8374902b04bc004`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(
      page.getByText("Message update unavailable. Try again.", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:977:11

[apps/web/e2e/request-conversations.spec.ts:977](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:977); SHA-256 `ce3321b7b75cf23f4cadccd2d431b3d0c5919d310ae126da5b6bc86aec7f8a75`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(chat.getByRole("alert")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:978:11

[apps/web/e2e/request-conversations.spec.ts:978](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:978); SHA-256 `3b9c529a50aeb8f99e99bf9f26f6d69a205714a943496a2d1efca39dc2539e72`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(chat.getByLabel("Edit message", { exact: true })).toHaveValue(
      "Corrected message",
    )
```

### apps/web/e2e/request-conversations.spec.ts:983:11

[apps/web/e2e/request-conversations.spec.ts:983](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:983); SHA-256 `81ba9e11947919cbfc8d05e0dfd951de4ccdaec4f72532babd2a7f673486548d`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(
      clientChat.getByText("Corrected message", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:986:11

[apps/web/e2e/request-conversations.spec.ts:986](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:986); SHA-256 `7f5e5d0528365649dbc6de80567bd8bc3ffaa854b8e3e4d12a35c8f50cf893d9`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(chat.getByLabel("Edit message", { exact: true })).toHaveCount(
      0,
    )
```

### apps/web/e2e/request-conversations.spec.ts:997:5

[apps/web/e2e/request-conversations.spec.ts:997](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:997); SHA-256 `a3ae2fd4b8e403acbd500e1e34defb7a775a192a3b83a34d87fb20f583b33532`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(mutations).toEqual(["PATCH", "PATCH"])
```

### apps/web/e2e/request-conversations.spec.ts:1005:11

[apps/web/e2e/request-conversations.spec.ts:1005](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1005); SHA-256 `893f193f6e1c3fb3f07484e0fe72381ed6486f46ee54e4693fe63e11902aecc3`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(
      clientChat.getByText("This message was deleted", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1008:11

[apps/web/e2e/request-conversations.spec.ts:1008](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1008); SHA-256 `2505c14cd10c996a24ff1dcc496b202f93ba74db65939b759862f39f4ab500ec`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(
      chat.getByText("This message was deleted", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1011:11

[apps/web/e2e/request-conversations.spec.ts:1011](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1011); SHA-256 `4ab0f4951c714f0196de5f9c76262699049a5a93076514257de20445b393cab6`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(menu).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1012:5

[apps/web/e2e/request-conversations.spec.ts:1012](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1012); SHA-256 `a2f6b6f2f08536ee36a9f1c9ed20a69ab9cd1614576fba7f9f8f4f360d99babf`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(mutations).toEqual(["PATCH", "PATCH", "DELETE"])
```

### apps/web/e2e/request-conversations.spec.ts:1013:5

[apps/web/e2e/request-conversations.spec.ts:1013](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1013); SHA-256 `77e4e16ad906e468bba18fa6f39dcb49a79225fb8d9eee3e3247df4b2f0bd069`.

Direct callback owners: PW-171, PW-172.

All possible owners, including helper/route/hook candidates: PW-171, PW-172.

```ts
expect(state.messages).toHaveLength(1)
```

### apps/web/e2e/request-conversations.spec.ts:1035:9

[apps/web/e2e/request-conversations.spec.ts:1035](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1035); SHA-256 `99724fa56b4e3f4222afea4d3c50e03d690839f8dd2f134850895ef29fc24084`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(chat.getByRole("article")).toHaveCount(50)
```

### apps/web/e2e/request-conversations.spec.ts:1037:9

[apps/web/e2e/request-conversations.spec.ts:1037](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1037); SHA-256 `91af66ff3841e9b1527c2cf9fa26762a8b5e1b6c9bf1532972c7b3166e8b8da9`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(chat.getByRole("article")).toHaveCount(52)
```

### apps/web/e2e/request-conversations.spec.ts:1051:9

[apps/web/e2e/request-conversations.spec.ts:1051](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1051); SHA-256 `e98f2ade883d2304388c8b68d2a130f804e4e73d57da0decfd42a2104b3cd9bb`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(
    chat.getByText("Reply sent while you were disconnected"),
  ).toBeAttached()
```

### apps/web/e2e/request-conversations.spec.ts:1054:9

[apps/web/e2e/request-conversations.spec.ts:1054](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1054); SHA-256 `f0b3a51ef02eed1d9aa795aa8971aa015be8200a25906229d56d17dc130d2389`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(chat.getByRole("article")).toHaveCount(53)
```

### apps/web/e2e/request-conversations.spec.ts:1056:9

[apps/web/e2e/request-conversations.spec.ts:1056](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1056); SHA-256 `fb10fce11b2a05a301a7ab736138dbe6fbf06a60aa40bdb23963aa1512aa4308`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(
    page.getByText("You no longer have access to this conversation.", {
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1061:9

[apps/web/e2e/request-conversations.spec.ts:1061](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1061); SHA-256 `ce3321b7b75cf23f4cadccd2d431b3d0c5919d310ae126da5b6bc86aec7f8a75`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(chat.getByRole("alert")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1062:9

[apps/web/e2e/request-conversations.spec.ts:1062](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1062); SHA-256 `6a1072671ae1d875121b9dc0203be522ac29ea68056f20789bd1560035b24953`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(chat.getByRole("article")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1063:9

[apps/web/e2e/request-conversations.spec.ts:1063](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1063); SHA-256 `7d86da5d7e4fbcd594582ac5ddf7fa36175870a4caf905f97ae7ff56aaa8a813`.

Direct callback owners: PW-173.

All possible owners, including helper/route/hook candidates: PW-173.

```ts
expect(chat.getByLabel("Message", { exact: true })).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1249:13

[apps/web/e2e/request-conversations.spec.ts:1249](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1249); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1250:13

[apps/web/e2e/request-conversations.spec.ts:1250](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1250); SHA-256 `95979f2ffce790b6091aa11267db8ff0f47dfe10a1ebeaf5e2a90274fdea0fe2`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1255:7

[apps/web/e2e/request-conversations.spec.ts:1255](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1255); SHA-256 `cb93b92dfd987e506bbb65a291ccf7797b519874df8e7ca01674d3a7e9dcf193`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheetBox).not.toBeNull()
```

### apps/web/e2e/request-conversations.spec.ts:1256:7

[apps/web/e2e/request-conversations.spec.ts:1256](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1256); SHA-256 `d03046b4fa36700d1099779130013d174b715b712910daa92e5362704859fd6c`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(composerBox).not.toBeNull()
```

### apps/web/e2e/request-conversations.spec.ts:1257:7

[apps/web/e2e/request-conversations.spec.ts:1257](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1257); SHA-256 `4ffb2a134a607a94a04f133c5d6b839ce31751412e3dabf53b0d82f91cc99917`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheetBox!.height).toBeLessThanOrEqual(400)
```

### apps/web/e2e/request-conversations.spec.ts:1258:7

[apps/web/e2e/request-conversations.spec.ts:1258](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1258); SHA-256 `07b825ed2f399db8d663c4e2e935156c5478866e629301a817772f95d7849146`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(composerBox!.y - sheetBox!.y - sheetBox!.height).toBeCloseTo(8, 0)
```

### apps/web/e2e/request-conversations.spec.ts:1262:13

[apps/web/e2e/request-conversations.spec.ts:1262](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1262); SHA-256 `545ba3aa7454963a7203d24d7cf06182caefc554859393080fc2a793fe22ebd0`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet).toContainText("Selecting services is optional.")
```

### apps/web/e2e/request-conversations.spec.ts:1263:13

[apps/web/e2e/request-conversations.spec.ts:1263](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1263); SHA-256 `03542a1f9ae3d2ff88cd58602fd1cd6d613306a9920bbc0e1c8df4eb7a7f9b00`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet.getByRole("radio")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1264:13

[apps/web/e2e/request-conversations.spec.ts:1264](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1264); SHA-256 `3cb4f96d0a7fbf99d8d8001b5e673f945308882c3e7c64217dd8bfc0e265b38e`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet.locator("input:checked")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1265:13

[apps/web/e2e/request-conversations.spec.ts:1265](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1265); SHA-256 `a78f8705ec390b2ed4f5c7fee9c4c9a301e196bd4e09c27cfe62c3143e75aca3`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet).toContainText("General meeting · No specific service")
```

### apps/web/e2e/request-conversations.spec.ts:1282:15

[apps/web/e2e/request-conversations.spec.ts:1282](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1282); SHA-256 `56a012455b65e800e39f774bd3a0fe4136a17423ecbfb3cf4be8adcd33cd39ea`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet).toContainText("2 related services")
```

### apps/web/e2e/request-conversations.spec.ts:1288:15

[apps/web/e2e/request-conversations.spec.ts:1288](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1288); SHA-256 `9a1b83815f645e55c9e6c9f53cb43e03177fba6352fe38741ce2ecd3ca54d52f`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet.getByRole("alert")).toHaveText(
          "Connection interrupted. Try again.",
        )
```

### apps/web/e2e/request-conversations.spec.ts:1300:13

[apps/web/e2e/request-conversations.spec.ts:1300](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1300); SHA-256 `aa8ceb90df19c362a4d80e7c62219d146f9be7e87d40e67a8f263a09850fdb59`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(sheet).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1301:13

[apps/web/e2e/request-conversations.spec.ts:1301](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1301); SHA-256 `b4d94f0aa711d71f3f13559a07f6de6808ab96ee0b96640a8c8301be8ac0dd90`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(
        chat.getByRole("textbox", { name: "Message", exact: true }),
      ).toHaveValue("Keep this general message draft")
```

### apps/web/e2e/request-conversations.spec.ts:1305:5

[apps/web/e2e/request-conversations.spec.ts:1305](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1305); SHA-256 `2d0999be44130dd51625e050ff5ebe3a1afbb3e7befa9b9b6fac419dd1a7d80a`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(posts.map((input) => input.bookingIds)).toEqual([
      [],
      [],
      ["seo", "website"],
    ])
```

### apps/web/e2e/request-conversations.spec.ts:1310:5

[apps/web/e2e/request-conversations.spec.ts:1310](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1310); SHA-256 `59762f9db308427970e7336eeb7e1699caad60770f7b7ad6e1f7241fc08feb31`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(posts[0]!.clientActionId).toBe(posts[1]!.clientActionId)
```

### apps/web/e2e/request-conversations.spec.ts:1311:5

[apps/web/e2e/request-conversations.spec.ts:1311](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1311); SHA-256 `cc549702188b0c37a66e63940d1056732165ad054e03530094be2d18ae509634`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(state.meetings.get("shared-design")).toHaveLength(2)
```

### apps/web/e2e/request-conversations.spec.ts:1314:11

[apps/web/e2e/request-conversations.spec.ts:1314](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1314); SHA-256 `d96d54ee81b3c3cc267e685c8628ffd82c50806bb7d1e919f90bfced1068ec95`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(
      log.getByRole("heading", { name: "Consultation/meeting", exact: true }),
    ).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1317:11

[apps/web/e2e/request-conversations.spec.ts:1317](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1317); SHA-256 `f6db47a3887b5041cbf1f11d2b3ee647fb4735ac9662a1fe27a9085737305f3f`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(
      log.getByText("General catch-up", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1320:11

[apps/web/e2e/request-conversations.spec.ts:1320](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1320); SHA-256 `861670c176ee32f36e1946a5c42488bd6abd06b75e2549fde39df131bdbcbdc4`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(
      log.getByText("Website and SEO review", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1323:11

[apps/web/e2e/request-conversations.spec.ts:1323](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1323); SHA-256 `681ff4b9d12f904bdf8a2eef4f876c707c6007f2f72db174587638ad2fec4737`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(
      log.getByRole("link", { name: "Join meeting", exact: true }),
    ).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1326:11

[apps/web/e2e/request-conversations.spec.ts:1326](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1326); SHA-256 `3313f06cd72e971827444c99c98a92589c71d133dfe3a99e05fd0495bab46c73`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(log.getByLabel("Related services")).toContainText(
      "Website · SR-101",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1329:11

[apps/web/e2e/request-conversations.spec.ts:1329](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1329); SHA-256 `56c489d5050373a6e13b80e7c34962277fa9d3269820cbdd8e920ea4bf00a4fd`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(log.getByLabel("Related services")).toContainText(
      "SEO · SR-102",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1332:11

[apps/web/e2e/request-conversations.spec.ts:1332](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1332); SHA-256 `dfeeaeb854be1a1accbfb522ff019c5207ac73975a1c222032c1085566a26019`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(page).toHaveURL(/request=shared-design$/)
```

### apps/web/e2e/request-conversations.spec.ts:1333:5

[apps/web/e2e/request-conversations.spec.ts:1333](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1333); SHA-256 `a467e36b00a7e3dbba9014e6e2cb62b4ed4185a0817c060de32ff107d7dcd6c6`.

Direct callback owners: PW-174, PW-176.

All possible owners, including helper/route/hook candidates: PW-174, PW-176.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1372:9

[apps/web/e2e/request-conversations.spec.ts:1372](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1372); SHA-256 `281f860fdfbe1c31231ed6d7d475f3b7bb1025189fdc6941fdcfcbd94211646a`.

Direct callback owners: PW-175, PW-177.

All possible owners, including helper/route/hook candidates: PW-175, PW-177.

```ts
expect(action.type).toBe("REQUEST_RESCHEDULE")
```

### apps/web/e2e/request-conversations.spec.ts:1373:9

[apps/web/e2e/request-conversations.spec.ts:1373](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1373); SHA-256 `033b086f3072ac4f1e86e62437c4d53a1ccec646ab256e57c318465e7bb8d132`.

Direct callback owners: PW-175, PW-177.

All possible owners, including helper/route/hook candidates: PW-175, PW-177.

```ts
expect(action.expectedVersion).toBe(0)
```

### apps/web/e2e/request-conversations.spec.ts:1399:11

[apps/web/e2e/request-conversations.spec.ts:1399](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1399); SHA-256 `8cf09355e6167382445845a3643e5e1b6112d6cc7cf573aa82facef4da9ef42f`.

Direct callback owners: PW-175, PW-177.

All possible owners, including helper/route/hook candidates: PW-175, PW-177.

```ts
expect(log).toContainText(
      "The existing schedule remains until the department head confirms a change.",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1402:11

[apps/web/e2e/request-conversations.spec.ts:1402](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1402); SHA-256 `5369b6f1796b8bbda3966f0b24c6fff2ff60523306de77539a519aa5db183f1e`.

Direct callback owners: PW-175, PW-177.

All possible owners, including helper/route/hook candidates: PW-175, PW-177.

```ts
expect(
      log.getByRole("button", { name: "Request reschedule", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/request-conversations.spec.ts:1405:11

[apps/web/e2e/request-conversations.spec.ts:1405](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1405); SHA-256 `54c781f221534de150fd3519c4dc97f184a9570ca99f2f54dc658571c2feaa56`.

Direct callback owners: PW-175, PW-177.

All possible owners, including helper/route/hook candidates: PW-175, PW-177.

```ts
expect(
      log.getByRole("button", { name: "Cancel meeting", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1408:5

[apps/web/e2e/request-conversations.spec.ts:1408](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1408); SHA-256 `5d9aa20ea8bb298d3cefe9ff040baedc5a7b4d8bfe08379512c0c122103f729a`.

Direct callback owners: PW-175, PW-177.

All possible owners, including helper/route/hook candidates: PW-175, PW-177.

```ts
expect(meeting.startsAt).toBe(startsAt)
```

### apps/web/e2e/request-conversations.spec.ts:1435:13

[apps/web/e2e/request-conversations.spec.ts:1435](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1435); SHA-256 `c359712a4df76983377d434b26a3f184608dc67b1f0a1b6178ad6c16b504cae2`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(nav.getByRole("link")).toHaveCount(1)
```

### apps/web/e2e/request-conversations.spec.ts:1439:13

[apps/web/e2e/request-conversations.spec.ts:1439](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1439); SHA-256 `d551dc8174fb8ed37ef7ed370ee72c03337feed4197c877632f68b9681beff7b`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(log.getByRole("article")).toHaveCount(4)
```

### apps/web/e2e/request-conversations.spec.ts:1444:13

[apps/web/e2e/request-conversations.spec.ts:1444](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1444); SHA-256 `4f7d2b75c27b95b04497a618c900ddd3d989ee99e627f9a81757f5666c628133`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(panel.locator("img").first()).toHaveAttribute(
        "src",
        imageUrl,
      )
```

### apps/web/e2e/request-conversations.spec.ts:1478:13

[apps/web/e2e/request-conversations.spec.ts:1478](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1478); SHA-256 `e28ee2312e5979cc4ecb605ac6fa648a203ef2a9580203c14db0bab08e12fecd`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(panel.getByRole("status")).toHaveText(
        "Loading service details…",
      )
```

### apps/web/e2e/request-conversations.spec.ts:1481:7

[apps/web/e2e/request-conversations.spec.ts:1481](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1481); SHA-256 `7941da6d7c87a6dfcaeedc1cdbd99ad92f679dd94c892c10d3e75806e09778e0`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await panelElement!.evaluate((element) => element.isConnected),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1484:7

[apps/web/e2e/request-conversations.spec.ts:1484](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1484); SHA-256 `67d87a67c55739b8f0b947ce46ab9a4492cb8c44c8fe84d26718a53e01d964e5`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await detailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1489:7

[apps/web/e2e/request-conversations.spec.ts:1489](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1489); SHA-256 `8bacd1911aebbe629b68b637ee1f102d5b4c54530d98b7321124661d9169d4e0`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await serviceDetailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1494:13

[apps/web/e2e/request-conversations.spec.ts:1494](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1494); SHA-256 `88b52b8d4376aa6e2091ed05abae21db276e32cfdff167a240977eeaf4f9a074`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        panel.getByRole("button", { name: /SEO SR-102/ }),
      ).toHaveAttribute("aria-pressed", "true")
```

### apps/web/e2e/request-conversations.spec.ts:1498:13

[apps/web/e2e/request-conversations.spec.ts:1498](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1498); SHA-256 `3407609730534a5f53ab1a9462bb7e6f9033e43bf8c76a777a07a5af5ee4a489`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        panel.getByText("Requirements for SR-102", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1501:7

[apps/web/e2e/request-conversations.spec.ts:1501](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1501); SHA-256 `7941da6d7c87a6dfcaeedc1cdbd99ad92f679dd94c892c10d3e75806e09778e0`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await panelElement!.evaluate((element) => element.isConnected),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1504:7

[apps/web/e2e/request-conversations.spec.ts:1504](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1504); SHA-256 `67d87a67c55739b8f0b947ce46ab9a4492cb8c44c8fe84d26718a53e01d964e5`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await detailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1509:7

[apps/web/e2e/request-conversations.spec.ts:1509](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1509); SHA-256 `8bacd1911aebbe629b68b637ee1f102d5b4c54530d98b7321124661d9169d4e0`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await serviceDetailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1514:13

[apps/web/e2e/request-conversations.spec.ts:1514](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1514); SHA-256 `d551dc8174fb8ed37ef7ed370ee72c03337feed4197c877632f68b9681beff7b`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(log.getByRole("article")).toHaveCount(4)
```

### apps/web/e2e/request-conversations.spec.ts:1521:15

[apps/web/e2e/request-conversations.spec.ts:1521](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1521); SHA-256 `c4ecc07f34879980939fa309df42724e6fa057bbd111f67ce6167aafe6b9f32d`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(log.getByText(text, { exact: true })).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1522:13

[apps/web/e2e/request-conversations.spec.ts:1522](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1522); SHA-256 `ace55389c6cc9677533851cf5d72dec3ec9816f1449c52dbf9d36cde151b4887`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(chat.getByLabel("Message", { exact: true })).toHaveValue(
        "A shared draft for the department",
      )
```

### apps/web/e2e/request-conversations.spec.ts:1525:13

[apps/web/e2e/request-conversations.spec.ts:1525](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1525); SHA-256 `616f518473cecde619277434d1d0c406808652875f0836f3bb3a752881e5b51e`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        chat.getByLabel("Message context", { exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1528:7

[apps/web/e2e/request-conversations.spec.ts:1528](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1528); SHA-256 `8b520284a583edba665420ef3a6c56677d95dab4790ef173c506aaef7e8a97af`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(reads).toEqual([])
```

### apps/web/e2e/request-conversations.spec.ts:1556:13

[apps/web/e2e/request-conversations.spec.ts:1556](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1556); SHA-256 `3e0f0d5c3acdbe8b1b2acde452c44464c013be8aab52c622012184ac7d766157`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        log.getByText("A shared draft for the department", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1559:7

[apps/web/e2e/request-conversations.spec.ts:1559](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1559); SHA-256 `1d0a37b04dd63616b56e375ce9a0c2a7303e358bdb0267f3be9c037103ac3078`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(sends).toHaveLength(1)
```

### apps/web/e2e/request-conversations.spec.ts:1560:7

[apps/web/e2e/request-conversations.spec.ts:1560](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1560); SHA-256 `9bf7d4fce0b664832924ecf696cc032b894991566c24893606d63b2d7291ad1c`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(sends[0]).not.toHaveProperty("bookingId")
```

### apps/web/e2e/request-conversations.spec.ts:1561:13

[apps/web/e2e/request-conversations.spec.ts:1561](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1561); SHA-256 `dfeeaeb854be1a1accbfb522ff019c5207ac73975a1c222032c1085566a26019`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(page).toHaveURL(/request=shared-design$/)
```

### apps/web/e2e/request-conversations.spec.ts:1562:7

[apps/web/e2e/request-conversations.spec.ts:1562](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1562); SHA-256 `314e19e1cc0f9e511a7e856164a76b07a1c0617c89248236b6810eb2275a741d`.

Direct callback owners: PW-178, PW-179, PW-180, PW-181.

All possible owners, including helper/route/hook candidates: PW-178, PW-179, PW-180, PW-181.

```ts
expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
```

### apps/web/e2e/request-conversations.spec.ts:1603:11

[apps/web/e2e/request-conversations.spec.ts:1603](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1603); SHA-256 `a1e9f8674fb0188581e03e2aa54ee1901d85eea19ec59481efd87c70cc95cdcc`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(menu.getByRole("radio")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1610:13

[apps/web/e2e/request-conversations.spec.ts:1610](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1610); SHA-256 `6ed06e68c18f9aa1076bbe8f0182083da1bc1d1bb4e20ee58907328fa2854d6e`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
        menu.getByRole("menuitem", { name, exact: true }),
      ).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:1613:11

[apps/web/e2e/request-conversations.spec.ts:1613](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1613); SHA-256 `c08d1517b5741df9d66cd8645f26afb5e7b85b544c31fbced752a20f22c77454`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(menu.getByRole("menuitem")).toHaveCount(4)
```

### apps/web/e2e/request-conversations.spec.ts:1622:13

[apps/web/e2e/request-conversations.spec.ts:1622](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1622); SHA-256 `8b6f55fa92e35bdd8cd16a667815f334a4aac71e480e57b6aae2b8cc88f41861`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
        menu.getByRole("menuitem", { name, exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1635:11

[apps/web/e2e/request-conversations.spec.ts:1635](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1635); SHA-256 `f5df200d407507cf4d050afe8d01a58e02f6f0daad12cff15b2b17e22ce4c4f0`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(proceed).toBeDisabled()
```

### apps/web/e2e/request-conversations.spec.ts:1636:11

[apps/web/e2e/request-conversations.spec.ts:1636](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1636); SHA-256 `8c3ecf04efb8587f0c68d3a1aaa487efb9212ce97feb8f5b2f315f634924309e`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context.locator("input:checked")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1637:11

[apps/web/e2e/request-conversations.spec.ts:1637](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1637); SHA-256 `50db79abebbb809f09916910a515802bc6dee20195c439986a089f78b44e8725`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context.getByRole("radio")).toHaveCount(1)
```

### apps/web/e2e/request-conversations.spec.ts:1638:11

[apps/web/e2e/request-conversations.spec.ts:1638](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1638); SHA-256 `24d5cb6db3146d25e407f8e228ba7bf72931a0786d0cf37fad7af4b3dbf59e27`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context).toContainText("Some services could not be checked.")
```

### apps/web/e2e/request-conversations.spec.ts:1643:11

[apps/web/e2e/request-conversations.spec.ts:1643](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1643); SHA-256 `1dbd5084db8beb324b82423d7ae1671f55af0d724828e916a85a684a16d9f4a2`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context.getByRole("radio")).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1647:11

[apps/web/e2e/request-conversations.spec.ts:1647](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1647); SHA-256 `3956b41c0842e9dbe603884f557f993aa0cba86e801ac9b640c4009ac6f3fbe4`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context).toContainText("Couldn't load tools for this booking.")
```

### apps/web/e2e/request-conversations.spec.ts:1651:11

[apps/web/e2e/request-conversations.spec.ts:1651](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1651); SHA-256 `394154d2d6496cfe696b42fa2fd9efcec5935fd52eeddc55fd38877b90b2214d`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(proceed).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:1661:11

[apps/web/e2e/request-conversations.spec.ts:1661](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1661); SHA-256 `0cd6aadafd331bc488941fa6222f9da21e07a758d0641a0da0c1b892574d3063`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(consultation).toContainText("Website · SR-101")
```

### apps/web/e2e/request-conversations.spec.ts:1675:11

[apps/web/e2e/request-conversations.spec.ts:1675](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1675); SHA-256 `8c3ecf04efb8587f0c68d3a1aaa487efb9212ce97feb8f5b2f315f634924309e`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context.locator("input:checked")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1676:11

[apps/web/e2e/request-conversations.spec.ts:1676](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1676); SHA-256 `985ff56b94813d4c5d8b5f122b34c4a3ddbd6f4c20f11bc3bcde354a0aed4c25`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
      context.getByRole("radio", { name: "Website SR-103", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1679:11

[apps/web/e2e/request-conversations.spec.ts:1679](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1679); SHA-256 `a6b53f940f86309d5e9cdba0bef34773d9b0d33e398297858e5d965c8b5ce580`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
      context.getByRole("radio", { name: "Website SR-104", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1682:11

[apps/web/e2e/request-conversations.spec.ts:1682](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1682); SHA-256 `1dbd5084db8beb324b82423d7ae1671f55af0d724828e916a85a684a16d9f4a2`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(context.getByRole("radio")).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1683:11

[apps/web/e2e/request-conversations.spec.ts:1683](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1683); SHA-256 `c20176ef466f1b2a408c7edc78c9da800402f332f1c744e09a3df72d6554f3d7`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
      context.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/request-conversations.spec.ts:1690:11

[apps/web/e2e/request-conversations.spec.ts:1690](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1690); SHA-256 `5d9474c4b6377b11e5ec64b7e7d8813e8a4579fd10336dcd97ef3493b470a4d9`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
      chat.getByRole("region", { name: "Prepare quotation", exact: true }),
    ).toContainText("SEO · SR-102")
```

### apps/web/e2e/request-conversations.spec.ts:1693:11

[apps/web/e2e/request-conversations.spec.ts:1693](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1693); SHA-256 `c38a80df006f3362d43f50c8d10f99931d168e52b1634ab5498e435586a11d14`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(chat.getByRole("log").getByRole("article")).toHaveCount(4)
```

### apps/web/e2e/request-conversations.spec.ts:1694:11

[apps/web/e2e/request-conversations.spec.ts:1694](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1694); SHA-256 `dfeeaeb854be1a1accbfb522ff019c5207ac73975a1c222032c1085566a26019`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(page).toHaveURL(/request=shared-design$/)
```

### apps/web/e2e/request-conversations.spec.ts:1695:11

[apps/web/e2e/request-conversations.spec.ts:1695](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1695); SHA-256 `29de929c25aee2aba1624938f1f435dee6b3cc237d048af5618bc97de7c41314`.

Direct callback owners: PW-182, PW-183.

All possible owners, including helper/route/hook candidates: PW-182, PW-183.

```ts
expect(
      chat.getByLabel("Message context", { exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1719:11

[apps/web/e2e/request-conversations.spec.ts:1719](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1719); SHA-256 `a6e1cfb5c3839e7c11addb86371ce8d988f4bec579eef045ef9fb0ad23514bd0`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(context.getByRole("radio")).toHaveCount(3)
```

### apps/web/e2e/request-conversations.spec.ts:1724:11

[apps/web/e2e/request-conversations.spec.ts:1724](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1724); SHA-256 `1aace92abf27f7858b53cc401e48cfa5843ea9a86e735ba009e6995240524a30`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(
      page.getByRole("menuitem", { name: "Create quotation", exact: true }),
    ).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:1730:11

[apps/web/e2e/request-conversations.spec.ts:1730](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1730); SHA-256 `315ecc1028966785c1a6f2d0222bff43d05bce0c173f756381205f8e773b6c73`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(context).toContainText("No eligible services for this action.")
```

### apps/web/e2e/request-conversations.spec.ts:1731:11

[apps/web/e2e/request-conversations.spec.ts:1731](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1731); SHA-256 `487b7a65d5514a8c9b8681145e43c527bfe93ad49726e6a902aad5d8536d21f4`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(context.getByRole("radio")).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1732:11

[apps/web/e2e/request-conversations.spec.ts:1732](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1732); SHA-256 `c20176ef466f1b2a408c7edc78c9da800402f332f1c744e09a3df72d6554f3d7`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(
      context.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/request-conversations.spec.ts:1738:11

[apps/web/e2e/request-conversations.spec.ts:1738](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1738); SHA-256 `ea3dcad5d65023727165d2c9afe517158be12dc821939701345ee5a01a48a3da`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(
      page.getByRole("menuitem", { name: "Create quotation", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1741:11

[apps/web/e2e/request-conversations.spec.ts:1741](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1741); SHA-256 `ddfa9437df3e26a859340031107095cd72de44221a0cd017112766f0e1f75f2f`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(
      page.getByRole("menuitem", { name: "Project activation", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1744:11

[apps/web/e2e/request-conversations.spec.ts:1744](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1744); SHA-256 `5d4ac775124957046b7d68e040092bef7f947883915dd2fb2e818220c6459bf0`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(page.getByRole("menuitem")).toHaveCount(3)
```

### apps/web/e2e/request-conversations.spec.ts:1745:11

[apps/web/e2e/request-conversations.spec.ts:1745](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1745); SHA-256 `dfeeaeb854be1a1accbfb522ff019c5207ac73975a1c222032c1085566a26019`.

Direct callback owners: PW-184, PW-185.

All possible owners, including helper/route/hook candidates: PW-184, PW-185.

```ts
expect(page).toHaveURL(/request=shared-design$/)
```

### apps/web/e2e/request-conversations.spec.ts:1844:7

[apps/web/e2e/request-conversations.spec.ts:1844](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1844); SHA-256 `d32cd426a54d2cb2ebd560c7f77955e735e803f3836c5a24301f6e93ee732985`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(new URL(route.request().url()).pathname).toBe(
        "/api/request-workflows/seo/actions",
      )
```

### apps/web/e2e/request-conversations.spec.ts:1856:11

[apps/web/e2e/request-conversations.spec.ts:1856](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1856); SHA-256 `d551dc8174fb8ed37ef7ed370ee72c03337feed4197c877632f68b9681beff7b`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(log.getByRole("article")).toHaveCount(4)
```

### apps/web/e2e/request-conversations.spec.ts:1857:11

[apps/web/e2e/request-conversations.spec.ts:1857](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1857); SHA-256 `3982ff4bae4c2b98f251399af328505d32712f777608fec3840879cfedd8a60f`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(
      log.getByRole("button", { name: "View booking", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1860:11

[apps/web/e2e/request-conversations.spec.ts:1860](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1860); SHA-256 `2dad7c0e3bea748c89da9263b18c255596a305985a89a8cc4dfe2687e8d7c8fb`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(
      log.getByRole("article").getByRole("button", { name: /SR-10/ }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1863:11

[apps/web/e2e/request-conversations.spec.ts:1863](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1863); SHA-256 `793b3e809db94f656693403d7cdfe203e4a2a49d9bc6bca82217084cbb880195`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(
      log.getByRole("button", {
        name: "Download seo-payment-receipt.pdf",
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:1869:11

[apps/web/e2e/request-conversations.spec.ts:1869](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1869); SHA-256 `31da8d9a1c2ea85208044f9af41a986dc09aed5b54dd9de088cbaaeba3f7a232`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(log.getByText("10/30/2026", { exact: true })).toHaveCount(1)
```

### apps/web/e2e/request-conversations.spec.ts:1876:11

[apps/web/e2e/request-conversations.spec.ts:1876](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1876); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-conversations.spec.ts:1877:5

[apps/web/e2e/request-conversations.spec.ts:1877](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1877); SHA-256 `1611772b67c8d44eddd4cea66c519ede549d1aa06a58cb4895da53cd2aa2ebd9`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(actions[0]).toMatchObject({ type: "VERIFY_PAYMENT", approve: true })
```

### apps/web/e2e/request-conversations.spec.ts:1878:11

[apps/web/e2e/request-conversations.spec.ts:1878](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1878); SHA-256 `203e8104fe1c318c6ecbb798528ecf6f64cc60be0c9a7118070888cfd6c9c62c`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(
      log.getByRole("button", { name: "Confirm payment", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:1882:11

[apps/web/e2e/request-conversations.spec.ts:1882](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1882); SHA-256 `93c133d6855381125cd2567b8583cd465e09e4a842641b8ad7a350c5b7ee8855`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(panel.locator('button[aria-pressed="true"]')).toContainText(
      "SR-101",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1895:11

[apps/web/e2e/request-conversations.spec.ts:1895](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1895); SHA-256 `bf5671afd7e3f4cfe4cc6c909e31f4be7e173e25b7bfcf084fd9e0b12c94eaf1`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(page.getByRole("menuitem").last()).toHaveText(
      "Project activation",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1909:11

[apps/web/e2e/request-conversations.spec.ts:1909](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1909); SHA-256 `060d313fa754050017575cde52cbc84779993aca20e79965dcdc1d800cd8b6cf`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(setup).toContainText("SR-102")
```

### apps/web/e2e/request-conversations.spec.ts:1910:11

[apps/web/e2e/request-conversations.spec.ts:1910](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1910); SHA-256 `dae739faa4f6da9b7605a1c77a44073efc28ae8699fe358a94f4c67cef5e58f1`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(setup).toContainText(
      "No employees are assigned to this department.",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1913:11

[apps/web/e2e/request-conversations.spec.ts:1913](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1913); SHA-256 `362e90ec22e07aa5e8a9b2a1b1983f76469ae4f14870fce1d589d49cb2651412`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(
      setup.getByRole("button", { name: "Approve staffing", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/request-conversations.spec.ts:1917:11

[apps/web/e2e/request-conversations.spec.ts:1917](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1917); SHA-256 `85438c60026f5e4d32703c250bfe0bf9da7c900572ddf1640df689ccf1fd0054`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(panel.locator('button[aria-pressed="true"]')).toContainText(
      "SR-102",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1920:5

[apps/web/e2e/request-conversations.spec.ts:1920](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1920); SHA-256 `59f5b10f017cf12cb7e1c46bd7db5d297bccf3298f83e0204b59b9248e1bd4b3`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(
      await log.locator('[data-booking-event="seo"]').allTextContents(),
    ).toEqual(before)
```

### apps/web/e2e/request-conversations.spec.ts:1923:11

[apps/web/e2e/request-conversations.spec.ts:1923](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1923); SHA-256 `6e9a3e728321a0e7a8780793e3f09638b7a12d077994dc69ab002d96d96491a8`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(chat.getByLabel("Message", { exact: true })).toHaveValue(
      "A shared reply stays here",
    )
```

### apps/web/e2e/request-conversations.spec.ts:1926:11

[apps/web/e2e/request-conversations.spec.ts:1926](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1926); SHA-256 `dfeeaeb854be1a1accbfb522ff019c5207ac73975a1c222032c1085566a26019`.

Direct callback owners: PW-186, PW-187.

All possible owners, including helper/route/hook candidates: PW-186, PW-187.

```ts
expect(page).toHaveURL(/request=shared-design$/)
```

### apps/web/e2e/request-conversations.spec.ts:1957:9

[apps/web/e2e/request-conversations.spec.ts:1957](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1957); SHA-256 `c359712a4df76983377d434b26a3f184608dc67b1f0a1b6178ad6c16b504cae2`.

Direct callback owners: PW-188.

All possible owners, including helper/route/hook candidates: PW-188.

```ts
expect(nav.getByRole("link")).toHaveCount(1)
```

### apps/web/e2e/request-conversations.spec.ts:1961:9

[apps/web/e2e/request-conversations.spec.ts:1961](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1961); SHA-256 `65fc3ac7ac3f2ee1bc4bc5b7f0b90826ced8017de4e4e0bb5622c2cac5fad860`.

Direct callback owners: PW-188.

All possible owners, including helper/route/hook candidates: PW-188.

```ts
expect(nav.getByRole("link")).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1967:9

[apps/web/e2e/request-conversations.spec.ts:1967](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1967); SHA-256 `9e7801454544b159576333b4a71efe4b3f3753331d4d459f8a3016580a2842ec`.

Direct callback owners: PW-188.

All possible owners, including helper/route/hook candidates: PW-188.

```ts
expect(
    nav.getByRole("link", { name: /^Rae Head, Design: 3 bookings/ }),
  ).toHaveAttribute("href", "/messages?request=shared-design")
```

### apps/web/e2e/request-conversations.spec.ts:1970:9

[apps/web/e2e/request-conversations.spec.ts:1970](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1970); SHA-256 `65fc3ac7ac3f2ee1bc4bc5b7f0b90826ced8017de4e4e0bb5622c2cac5fad860`.

Direct callback owners: PW-188.

All possible owners, including helper/route/hook candidates: PW-188.

```ts
expect(nav.getByRole("link")).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1995:9

[apps/web/e2e/request-conversations.spec.ts:1995](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1995); SHA-256 `65fc3ac7ac3f2ee1bc4bc5b7f0b90826ced8017de4e4e0bb5622c2cac5fad860`.

Direct callback owners: PW-189.

All possible owners, including helper/route/hook candidates: PW-189.

```ts
expect(nav.getByRole("link")).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:1997:9

[apps/web/e2e/request-conversations.spec.ts:1997](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1997); SHA-256 `dfeeaeb854be1a1accbfb522ff019c5207ac73975a1c222032c1085566a26019`.

Direct callback owners: PW-189.

All possible owners, including helper/route/hook candidates: PW-189.

```ts
expect(page).toHaveURL(/request=shared-design$/)
```

### apps/web/e2e/request-conversations.spec.ts:1998:9

[apps/web/e2e/request-conversations.spec.ts:1998](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:1998); SHA-256 `c69905d9e6e19f43d816d6698c0169290f2fae5e82524295cb55853bf4f44346`.

Direct callback owners: PW-189.

All possible owners, including helper/route/hook candidates: PW-189.

```ts
expect(page.getByLabel("Message", { exact: true })).toBeEnabled()
```

### apps/web/e2e/request-conversations.spec.ts:2018:9

[apps/web/e2e/request-conversations.spec.ts:2018](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2018); SHA-256 `f856a6539b9ad72f2f96625dba7305130b408085410ab57756139f1bf232cc4a`.

Direct callback owners: PW-190.

All possible owners, including helper/route/hook candidates: PW-190.

```ts
expect(clients).toHaveCount(2)
```

### apps/web/e2e/request-conversations.spec.ts:2020:9

[apps/web/e2e/request-conversations.spec.ts:2020](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2020); SHA-256 `0e4f54faa4c5dc17c22876587409fea039375df0bd69b5305cc2926690c76cbb`.

Direct callback owners: PW-190.

All possible owners, including helper/route/hook candidates: PW-190.

```ts
expect(page).toHaveURL(/request=other-client$/)
```

### apps/web/e2e/request-conversations.spec.ts:2021:9

[apps/web/e2e/request-conversations.spec.ts:2021](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2021); SHA-256 `f5da5c7f7bfa59365ffc7fa8ead80ec6d514301ca862f68d49b43a803d6dc81e`.

Direct callback owners: PW-190.

All possible owners, including helper/route/hook candidates: PW-190.

```ts
expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
    "href",
    "/messages?request=other-client",
  )
```

### apps/web/e2e/request-conversations.spec.ts:2228:15

[apps/web/e2e/request-conversations.spec.ts:2228](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2228); SHA-256 `44847125b379e489dad7373c25ffcc4f584fc117a49e643f4dc716d9477c0c23`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(panel).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2233:15

[apps/web/e2e/request-conversations.spec.ts:2233](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2233); SHA-256 `4c3e0ab04e0e611860ad4c90986ccc381d91735bebad59a2043467f49b5a6617`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByRole("heading", {
            name: "Conversation details",
            exact: true,
          }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2239:15

[apps/web/e2e/request-conversations.spec.ts:2239](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2239); SHA-256 `0e5b7467b524047ecc314a2483c2112e39d68c3adce35ebbbd99cf723d039728`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByText("No current booked services.", { exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2242:15

[apps/web/e2e/request-conversations.spec.ts:2242](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2242); SHA-256 `d5a9b57b707f8a64d757ce88067415ba29a05ea12fa5744d5e1e65aff2a39d7a`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByText("Service details", { exact: true }),
        ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:2245:15

[apps/web/e2e/request-conversations.spec.ts:2245](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2245); SHA-256 `4a73ab051533bb5910fa42a6a4a564cb14a8f64bd698041ad8345d99e3971e41`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByText("Loading service details…", { exact: true }),
        ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:2248:15

[apps/web/e2e/request-conversations.spec.ts:2248](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2248); SHA-256 `e31f4732751513b0b069536fd203c07928ff0d6cd85bcff1493607f577722566`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          chat.getByText("Let us discuss all our services here.", {
            exact: true,
          }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2253:9

[apps/web/e2e/request-conversations.spec.ts:2253](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2253); SHA-256 `a93ee0be33a200169dbca746943a85131bdc7abedeee1b34e64cd438a7ececbf`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(workflowReads).toEqual([])
```

### apps/web/e2e/request-conversations.spec.ts:2260:15

[apps/web/e2e/request-conversations.spec.ts:2260](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2260); SHA-256 `94a7dc90915d60f56569bd6b9676552f3668e7c4ecaa213479fa33ad4f148618`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByRole("button", { name: /SR-101/ }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2263:15

[apps/web/e2e/request-conversations.spec.ts:2263](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2263); SHA-256 `22de83206e797c8f04d650fb5aa68a380975101a464be1c4dda0cfdf6e901b98`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByText("Service details", { exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2268:15

[apps/web/e2e/request-conversations.spec.ts:2268](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2268); SHA-256 `0e5b7467b524047ecc314a2483c2112e39d68c3adce35ebbbd99cf723d039728`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByText("No current booked services.", { exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2271:15

[apps/web/e2e/request-conversations.spec.ts:2271](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2271); SHA-256 `4c3e0ab04e0e611860ad4c90986ccc381d91735bebad59a2043467f49b5a6617`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByRole("heading", {
            name: "Conversation details",
            exact: true,
          }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2277:15

[apps/web/e2e/request-conversations.spec.ts:2277](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2277); SHA-256 `d5a9b57b707f8a64d757ce88067415ba29a05ea12fa5744d5e1e65aff2a39d7a`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          panel.getByText("Service details", { exact: true }),
        ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:2280:15

[apps/web/e2e/request-conversations.spec.ts:2280](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2280); SHA-256 `487d9ceaa4769614f06c70fd9aa34fa604d0025175e7d027afe4711edb99ee68`.

Direct callback owners: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

All possible owners, including helper/route/hook candidates: PW-191, PW-192, PW-193, PW-194, PW-196, PW-197, PW-198, PW-199.

```ts
expect(
          chat.getByRole("textbox", { name: "Message", exact: true }),
        ).toHaveValue("Our conversation stays available.")
```

### apps/web/e2e/request-conversations.spec.ts:2296:11

[apps/web/e2e/request-conversations.spec.ts:2296](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2296); SHA-256 `be2d283fc4801c70919f2b8826fded4e8d191e14002cddf850c7734efe55caa1`.

Direct callback owners: PW-195, PW-200.

All possible owners, including helper/route/hook candidates: PW-195, PW-200.

```ts
expect(
      chat.getByText("Website discussion for SR-101", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2300:11

[apps/web/e2e/request-conversations.spec.ts:2300](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2300); SHA-256 `2453dbfb751f5100c8a5cf669fb120331b4b46da37cc6d4295c6f91e960477cf`.

Direct callback owners: PW-195, PW-200.

All possible owners, including helper/route/hook candidates: PW-195, PW-200.

```ts
expect(panel.getByRole("button", { name: /SR-101/ })).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:2301:11

[apps/web/e2e/request-conversations.spec.ts:2301](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2301); SHA-256 `4681cc9daaa4fc072d55efdcf361e29c60c1fca93820bdbd5ea56e13ef6b7eeb`.

Direct callback owners: PW-195, PW-200.

All possible owners, including helper/route/hook candidates: PW-195, PW-200.

```ts
expect(panel.getByRole("button", { name: /SR-102/ })).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:2302:11

[apps/web/e2e/request-conversations.spec.ts:2302](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2302); SHA-256 `5065f591f54b26360543adc09ca2b49eb91b13e6757d21b2d8445eb066de278d`.

Direct callback owners: PW-195, PW-200.

All possible owners, including helper/route/hook candidates: PW-195, PW-200.

```ts
expect(panel.getByRole("button", { name: /SR-103/ })).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2303:11

[apps/web/e2e/request-conversations.spec.ts:2303](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2303); SHA-256 `46c8b95da6aa5cada14083bb77e439e2ef52d620f6b536450fc61079df1595a0`.

Direct callback owners: PW-195, PW-200.

All possible owners, including helper/route/hook candidates: PW-195, PW-200.

```ts
expect(
      chat.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2306:11

[apps/web/e2e/request-conversations.spec.ts:2306](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2306); SHA-256 `2db8163bc6640e07ac48028e1c6eb29f7aac2e48855f884bb1a1b06b6f5cb8ea`.

Direct callback owners: PW-195, PW-200.

All possible owners, including helper/route/hook candidates: PW-195, PW-200.

```ts
expect(
      page.getByRole("button", { name: "Archived conversations", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-conversations.spec.ts:2333:15

[apps/web/e2e/request-conversations.spec.ts:2333](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2333); SHA-256 `6ff701c49723d5af23f76cc3f1b2ae66f99f2bcadd78b8928318ddd54dba424b`.

Direct callback owners: PW-201, PW-202, PW-203, PW-204.

All possible owners, including helper/route/hook candidates: PW-201, PW-202, PW-203, PW-204.

```ts
expect(
          menu.getByRole("menuitem", { name: "Attach file", exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2336:15

[apps/web/e2e/request-conversations.spec.ts:2336](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2336); SHA-256 `595038e2e6d5bcfc8ea2e1e50ed27910c3bd5b8e740fe6c78532bdd642c6952d`.

Direct callback owners: PW-201, PW-202, PW-203, PW-204.

All possible owners, including helper/route/hook candidates: PW-201, PW-202, PW-203, PW-204.

```ts
expect(menu.getByRole("menuitem")).toHaveCount(
          role === "STAFF" ? 2 : 1,
        )
```

### apps/web/e2e/request-conversations.spec.ts:2340:17

[apps/web/e2e/request-conversations.spec.ts:2340](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2340); SHA-256 `fbd8292bdc68779b1a2fa503f620dca34eb60f3db258b0aa2fc9ac80b3eca0c9`.

Direct callback owners: PW-201, PW-202, PW-203, PW-204.

All possible owners, including helper/route/hook candidates: PW-201, PW-202, PW-203, PW-204.

```ts
expect(
            menu.getByRole("menuitem", {
              name: "Schedule consultation/meeting",
              exact: true,
            }),
          ).toBeVisible()
```

### apps/web/e2e/request-conversations.spec.ts:2356:17

[apps/web/e2e/request-conversations.spec.ts:2356](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2356); SHA-256 `5059ffe178c5a06194267d91c42cc19e7963acffa675b9a3eb21e4ab3fb9b924`.

Direct callback owners: PW-201, PW-202, PW-203, PW-204.

All possible owners, including helper/route/hook candidates: PW-201, PW-202, PW-203, PW-204.

```ts
expect(
            menu.getByRole("menuitem", { name, exact: true }),
          ).toHaveCount(0)
```

## apps/web/e2e/request-inbox.spec.ts

### apps/web/e2e/request-inbox.spec.ts:38:11

[apps/web/e2e/request-inbox.spec.ts:38](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:38); SHA-256 `acebf609f66aed8a50e97d9eb224724a6e21447dad014ecf54171f3a66e8deee`.

Direct callback owners: PW-205, PW-207.

All possible owners, including helper/route/hook candidates: PW-205, PW-207.

```ts
expect(page.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:41:11

[apps/web/e2e/request-inbox.spec.ts:41](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:41); SHA-256 `450bd9391e6efdbc9e3bfa8259c0f9a47f80eb1dde3030397938567be78a8fd4`.

Direct callback owners: PW-205, PW-207.

All possible owners, including helper/route/hook candidates: PW-205, PW-207.

```ts
expect(
      page.getByText("No requests match this view.", { exact: true }),
    ).toBeVisible({ timeout: 10_000 })
```

### apps/web/e2e/request-inbox.spec.ts:50:11

[apps/web/e2e/request-inbox.spec.ts:50](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:50); SHA-256 `82d4b3ee51ac39591ca3051f851afb41575bcb8469d0753de167e325a5c88ce6`.

Direct callback owners: PW-205, PW-207.

All possible owners, including helper/route/hook candidates: PW-205, PW-207.

```ts
expect(page.getByText("Under review", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:53:11

[apps/web/e2e/request-inbox.spec.ts:53](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:53); SHA-256 `c0550233fb8035ff9cb301665a57ef184e1181dd1ef602b24585aa69f0fefeb3`.

Direct callback owners: PW-205, PW-207.

All possible owners, including helper/route/hook candidates: PW-205, PW-207.

```ts
expect(page.getByText("Closed", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:54:5

[apps/web/e2e/request-inbox.spec.ts:54](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:54); SHA-256 `648cf2d21e277e3c511a6f5a7144182d5050ab7fba716f84bbe3b7bfa3d6be08`.

Direct callback owners: PW-205, PW-207.

All possible owners, including helper/route/hook candidates: PW-205, PW-207.

```ts
expect(state.queries.at(-1)).toContain("view=all")
```

### apps/web/e2e/request-inbox.spec.ts:72:11

[apps/web/e2e/request-inbox.spec.ts:72](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:72); SHA-256 `9e092b317f6dd4cdbaa0a646ad2baa5a6725d0209b96be86cbd72fd33d7b6070`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(
      page.getByText(
        "Accept this request for your department before opening its conversation.",
        { exact: true },
      ),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:78:11

[apps/web/e2e/request-inbox.spec.ts:78](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:78); SHA-256 `be335483b977552dc006e18205c48aff36836bd431f653edbbe7f966b4bb4b5f`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(page).toHaveURL(/\/request-inbox$/)
```

### apps/web/e2e/request-inbox.spec.ts:79:11

[apps/web/e2e/request-inbox.spec.ts:79](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:79); SHA-256 `af1bac3f22826db73a83a2b341c8f23d1796ddc4cade78fc3fdc93387e65294b`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(
      page.getByRole("combobox", { name: "Sort requests", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-inbox.spec.ts:91:11

[apps/web/e2e/request-inbox.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:91); SHA-256 `b612c0c7361b5472a334e04bb3ea23f63fb5464440f4b7887ebf830a3662cfd3`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect.poll(() => state.queries.at(-1)).toContain("sortDir=desc")
```

### apps/web/e2e/request-inbox.spec.ts:93:11

[apps/web/e2e/request-inbox.spec.ts:93](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:93); SHA-256 `4934a038d4b126c4af606fa9a60cea8f4b52bb90008ba28cdd863369cb86f6c0`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect.poll(() => state.queries.at(-1)).toContain("page=2")
```

### apps/web/e2e/request-inbox.spec.ts:94:5

[apps/web/e2e/request-inbox.spec.ts:94](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:94); SHA-256 `53143a427565bb9ec35f2945f30f4d8f8314ab59023b00d18fcd45c94baf0750`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(state.queries.at(-1)).toContain("sortBy=reference")
```

### apps/web/e2e/request-inbox.spec.ts:95:5

[apps/web/e2e/request-inbox.spec.ts:95](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:95); SHA-256 `87b6362bed38869ea6650b054a37b57643c5d24f09d1f6b8ac0dd0b1dd331edc`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(state.queries.at(-1)).toContain("sortDir=desc")
```

### apps/web/e2e/request-inbox.spec.ts:100:11

[apps/web/e2e/request-inbox.spec.ts:100](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:100); SHA-256 `e96fdfc3b69cd760b08b8ea279a03fb3a529f6de874946792d8a1518bbee973e`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:101:11

[apps/web/e2e/request-inbox.spec.ts:101](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:101); SHA-256 `504e303d070b648cbe979905df5cb0775b517d870701618ff9a1e11ebf3363e7`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(page.getByText("SR-INBOX-12", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:102:5

[apps/web/e2e/request-inbox.spec.ts:102](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:102); SHA-256 `b4f4fc90e3fc09c170fd98216494d849d484ae1529f11318f5ed9cd4842c921c`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(state.queries.at(-1)).toContain("page=1")
```

### apps/web/e2e/request-inbox.spec.ts:107:11

[apps/web/e2e/request-inbox.spec.ts:107](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:107); SHA-256 `421ed0a49963517548f1916333028a48de9fe5ab8a9b775773ab6aa5253d777d`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(
      page.getByText("No requests match this view.", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:116:11

[apps/web/e2e/request-inbox.spec.ts:116](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:116); SHA-256 `3426e0492f59369f093f40c13f118ab46b9c0d724bc050a3d5eb38f8f731c4ab`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(page.getByText("Showing 1–10 of 12")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:120:11

[apps/web/e2e/request-inbox.spec.ts:120](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:120); SHA-256 `cfe34a2b24209405df0098a4a1915e21ee10702e49947adeb4e4bb023ac267ee`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect.poll(() => state.queries.at(-1)).toContain("sortBy=service")
```

### apps/web/e2e/request-inbox.spec.ts:133:13

[apps/web/e2e/request-inbox.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:133); SHA-256 `27db3893fb072ed0cca35f9441427085d0164a0a27a67eed402a73bc6e01cf90`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect
        .poll(() => state.queries.at(-1))
        .toContain(`sortBy=${column}`)
```

### apps/web/e2e/request-inbox.spec.ts:136:13

[apps/web/e2e/request-inbox.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:136); SHA-256 `46b6c76c846c50e21256807ea46f85699ce3569332426ec1b1fc5703c254fed2`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(
        page.getByRole("columnheader", { name: new RegExp(label, "i") }),
      ).toHaveAttribute("aria-sort", "ascending")
```

### apps/web/e2e/request-inbox.spec.ts:145:13

[apps/web/e2e/request-inbox.spec.ts:145](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:145); SHA-256 `b2033f3e7074e855672c50998ee2f7c90d32c94fb77ef3dbd2e2fff536f3ff51`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(
        page.getByRole("columnheader", { name: new RegExp(label, "i") }),
      ).toHaveAttribute("aria-sort", "descending")
```

### apps/web/e2e/request-inbox.spec.ts:148:13

[apps/web/e2e/request-inbox.spec.ts:148](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:148); SHA-256 `b612c0c7361b5472a334e04bb3ea23f63fb5464440f4b7887ebf830a3662cfd3`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect.poll(() => state.queries.at(-1)).toContain("sortDir=desc")
```

### apps/web/e2e/request-inbox.spec.ts:151:11

[apps/web/e2e/request-inbox.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:151); SHA-256 `4934a038d4b126c4af606fa9a60cea8f4b52bb90008ba28cdd863369cb86f6c0`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect.poll(() => state.queries.at(-1)).toContain("page=2")
```

### apps/web/e2e/request-inbox.spec.ts:158:11

[apps/web/e2e/request-inbox.spec.ts:158](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:158); SHA-256 `832c1a0e83a62fc07920c6283d0792cc5be684999a7d22279bfc105c56e4e41c`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect.poll(() => state.queries.at(-1)).toContain("page=1")
```

### apps/web/e2e/request-inbox.spec.ts:163:5

[apps/web/e2e/request-inbox.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:163); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-206, PW-208.

All possible owners, including helper/route/hook candidates: PW-206, PW-208.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/request-inbox.spec.ts:189:9

[apps/web/e2e/request-inbox.spec.ts:189](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:189); SHA-256 `7db304ec1c7d6608468fbe5d07ab6bf37bde36ed3976752f79bed3d26f310d55`.

Direct callback owners: PW-209.

All possible owners, including helper/route/hook candidates: PW-209.

```ts
expect(
    page.getByText("Conversation unavailable for this account.", {
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:194:9

[apps/web/e2e/request-inbox.spec.ts:194](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:194); SHA-256 `be335483b977552dc006e18205c48aff36836bd431f653edbbe7f966b4bb4b5f`.

Direct callback owners: PW-209.

All possible owners, including helper/route/hook candidates: PW-209.

```ts
expect(page).toHaveURL(/\/request-inbox$/)
```

### apps/web/e2e/request-inbox.spec.ts:202:9

[apps/web/e2e/request-inbox.spec.ts:202](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:202); SHA-256 `bb311cfac76d748b265b645134f8789d2178c4892d2f42c9600a0a50b72b4b0d`.

Direct callback owners: PW-209.

All possible owners, including helper/route/hook candidates: PW-209.

```ts
expect(page).toHaveURL(/\/messages\?request=booking-1$/)
```

### apps/web/e2e/request-inbox.spec.ts:229:5

[apps/web/e2e/request-inbox.spec.ts:229](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:229); SHA-256 `169370ba1b07ac39824c84e67c2a2f8a05e3f286b3c60d136b8dc9751790605e`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-205, PW-206, PW-207, PW-208, PW-209, PW-210, PW-211, PW-212, PW-213, PW-214, PW-215, PW-216, PW-217, PW-218.

```ts
expect(request.headers().authorization).toBe("Bearer test-session")
```

### apps/web/e2e/request-inbox.spec.ts:350:9

[apps/web/e2e/request-inbox.spec.ts:350](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:350); SHA-256 `fb2dec8c0334d7456ebeac8c72d82a551d3054162a59b341ea8772413d2e7097`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-205, PW-206, PW-207, PW-208, PW-209, PW-210, PW-211, PW-212, PW-213, PW-214, PW-215, PW-216, PW-217, PW-218.

```ts
expect(request.method()).toBe(declining ? "POST" : "DELETE")
```

### apps/web/e2e/request-inbox.spec.ts:360:9

[apps/web/e2e/request-inbox.spec.ts:360](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:360); SHA-256 `4ecfe00535b0388344dbdc86bf686b46bfb7336d5b1555ce4d52ef84274ed6df`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-205, PW-206, PW-207, PW-208, PW-209, PW-210, PW-211, PW-212, PW-213, PW-214, PW-215, PW-216, PW-217, PW-218.

```ts
expect(request.method()).toBe("POST")
```

### apps/web/e2e/request-inbox.spec.ts:419:11

[apps/web/e2e/request-inbox.spec.ts:419](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:419); SHA-256 `965efe49cc9199de35290ba66de7adf68789bb5e21d38e8da44b92144f122e20`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(confirmation).toContainText("Website Development")
```

### apps/web/e2e/request-inbox.spec.ts:423:5

[apps/web/e2e/request-inbox.spec.ts:423](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:423); SHA-256 `6d1fab6d7c99bc0cc1eaaf0bf1953c4f0da17ad850f15d5b79bc5e1b6f70fece`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(state.mutations).toEqual([])
```

### apps/web/e2e/request-inbox.spec.ts:431:11

[apps/web/e2e/request-inbox.spec.ts:431](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:431); SHA-256 `6d807964d7e2daac38a59dc97a7513ac9586ed50001c549e5feacecbd73811ea`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect.poll(() => state.mutations.length).toBe(1)
```

### apps/web/e2e/request-inbox.spec.ts:432:11

[apps/web/e2e/request-inbox.spec.ts:432](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:432); SHA-256 `ec829af514b8538d0d391886e21468540c9cefdac431706ff9592691b7e43c0c`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(confirm).toBeEnabled()
```

### apps/web/e2e/request-inbox.spec.ts:433:5

[apps/web/e2e/request-inbox.spec.ts:433](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:433); SHA-256 `152cf9904c8ea75470045a3e468995d28b235bf7bd101220b4a60a9aca03139f`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(state.requests[0].status).toBe("SUBMITTED")
```

### apps/web/e2e/request-inbox.spec.ts:434:5

[apps/web/e2e/request-inbox.spec.ts:434](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:434); SHA-256 `aae5239ab8b4f2e9052f6384a8d6790c0976cd6b75a4f1f07d641296dc7bdf54`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(state.requests).toHaveLength(11)
```

### apps/web/e2e/request-inbox.spec.ts:437:11

[apps/web/e2e/request-inbox.spec.ts:437](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:437); SHA-256 `3ef64d017113a0e60c5ff5c7ad763ab581e78e18a1dd7eef1ed618ec2bddcaca`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(confirmation).not.toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:438:5

[apps/web/e2e/request-inbox.spec.ts:438](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:438); SHA-256 `c313e8486faf5c7e1866450a2bd7e8ef58fba6ce54eb1f14b897e1b397dd9dd3`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(state.mutations).toEqual(
      Array(2).fill("DELETE /api/request-inbox/booking-1"),
    )
```

### apps/web/e2e/request-inbox.spec.ts:441:5

[apps/web/e2e/request-inbox.spec.ts:441](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:441); SHA-256 `152cf9904c8ea75470045a3e468995d28b235bf7bd101220b4a60a9aca03139f`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(state.requests[0].status).toBe("SUBMITTED")
```

### apps/web/e2e/request-inbox.spec.ts:442:5

[apps/web/e2e/request-inbox.spec.ts:442](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:442); SHA-256 `aae5239ab8b4f2e9052f6384a8d6790c0976cd6b75a4f1f07d641296dc7bdf54`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(state.requests).toHaveLength(11)
```

### apps/web/e2e/request-inbox.spec.ts:444:11

[apps/web/e2e/request-inbox.spec.ts:444](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:444); SHA-256 `c9c45f7acadbb676e51cd528f978b1cb0274946126b06c0b9228048a608912bf`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(page.getByText("Showing 1–10 of 11")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:445:11

[apps/web/e2e/request-inbox.spec.ts:445](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:445); SHA-256 `a6c6b51f877456bc3f85681cd959739629849cd61500b122a42fe5849885591e`.

Direct callback owners: PW-210, PW-211.

All possible owners, including helper/route/hook candidates: PW-210, PW-211.

```ts
expect(review).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:456:11

[apps/web/e2e/request-inbox.spec.ts:456](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:456); SHA-256 `2cc4fbb9258118baf943628d344be921b85fc573138c072a8e1953c3bbbf8deb`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      page.getByRole("heading", { name: "Request Inbox", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:459:11

[apps/web/e2e/request-inbox.spec.ts:459](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:459); SHA-256 `c9c45f7acadbb676e51cd528f978b1cb0274946126b06c0b9228048a608912bf`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("Showing 1–10 of 11")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:460:11

[apps/web/e2e/request-inbox.spec.ts:460](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:460); SHA-256 `8a406644641561ab36b8f0ab3b7aaa8299b5555e8fa8b1abd041880ecdd8e19a`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      page.getByRole("table", { name: "Department requests" }),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:463:11

[apps/web/e2e/request-inbox.spec.ts:463](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:463); SHA-256 `acebf609f66aed8a50e97d9eb224724a6e21447dad014ecf54171f3a66e8deee`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:466:11

[apps/web/e2e/request-inbox.spec.ts:466](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:466); SHA-256 `885e6673daec7beef5a57b89732a99d4933a4c79e1b5f71497c9985c31f203b2`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      page.getByRole("link", { name: "Request Inbox", exact: true }),
    ).toHaveAttribute("aria-current", "page")
```

### apps/web/e2e/request-inbox.spec.ts:479:11

[apps/web/e2e/request-inbox.spec.ts:479](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:479); SHA-256 `038de55d786cf174829b8db1793bf5fd3fad59bc5898f35c31254ef149c01dea`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("Showing 11–11 of 11")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:480:11

[apps/web/e2e/request-inbox.spec.ts:480](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:480); SHA-256 `b1fb8e862177dee3202ad040a3c3932abee66242fb351036cdb935e475c65a5c`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("booking-11", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:484:11

[apps/web/e2e/request-inbox.spec.ts:484](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:484); SHA-256 `e96fdfc3b69cd760b08b8ea279a03fb3a529f6de874946792d8a1518bbee973e`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:485:11

[apps/web/e2e/request-inbox.spec.ts:485](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:485); SHA-256 `7cc1d7b068b8d43e1e3b8b9ed57303d64eb957a99d7c44f321d5cb67296d1388`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("SR-INBOX-2", { exact: true })).toHaveCount(1)
```

### apps/web/e2e/request-inbox.spec.ts:486:11

[apps/web/e2e/request-inbox.spec.ts:486](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:486); SHA-256 `748621954b6fdad08cf9590ab831010292d2748c06824d6a007a7f42917f064c`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("SR-INBOX-2", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:490:11

[apps/web/e2e/request-inbox.spec.ts:490](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:490); SHA-256 `2fcf621bb343f12b03b22d3c3d90813bc4b3d2683dd1421b869292b85f720fd6`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("Showing 1–3 of 3")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:495:11

[apps/web/e2e/request-inbox.spec.ts:495](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:495); SHA-256 `5bd852de22abdbd1ae5c4b43d35b1f9e07127254fffd6872e3c87053a5a2fa47`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:496:11

[apps/web/e2e/request-inbox.spec.ts:496](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:496); SHA-256 `92bbda77dc877abdd5b177c0780ca5f830ceab11d99046b0a6d7d4aa57fd1add`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      drawer.getByText("client1@example.com", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:499:11

[apps/web/e2e/request-inbox.spec.ts:499](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:499); SHA-256 `088dea1de2e2908e33af58ef84388995cd8fcf8f2edbf0d761da586ef54098e1`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      drawer.getByText("Five accessible pages and a contact form."),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:502:11

[apps/web/e2e/request-inbox.spec.ts:502](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:502); SHA-256 `40d99fa00a3a3f3faf90162b7ba0658dbb6950abe658c5df466f704b7d719395`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer.getByText("Reach more customers.")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:511:11

[apps/web/e2e/request-inbox.spec.ts:511](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:511); SHA-256 `f69cfd9b88bca27c2d904b72b8eeeae6dd7a24defed2f5e461a967551596e4ab`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      drawer.getByRole("button", { name: "Accepting…" }),
    ).toBeDisabled()
```

### apps/web/e2e/request-inbox.spec.ts:514:11

[apps/web/e2e/request-inbox.spec.ts:514](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:514); SHA-256 `75881555379a6b517de40c2ffa5ea3d3901061559fc53da3e1bdbc9cf871eff1`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      drawer.getByRole("button", { name: "Close booking details" }),
    ).toBeDisabled()
```

### apps/web/e2e/request-inbox.spec.ts:518:11

[apps/web/e2e/request-inbox.spec.ts:518](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:518); SHA-256 `505ffc5c1e7bb782ef6e01e19b46552f98d380ace1acf476fb27ee82a6da07f4`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:519:11

[apps/web/e2e/request-inbox.spec.ts:519](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:519); SHA-256 `1105acd6ec94cc5a690ab86a0a9e8c6750512fa7e8d22e73c3b90e1e0cf1c079`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect.poll(() => state.accepts).toBe(1)
```

### apps/web/e2e/request-inbox.spec.ts:521:11

[apps/web/e2e/request-inbox.spec.ts:521](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:521); SHA-256 `eee4c7cd4f55c796821046b4299343a443f56276e2994c3ba5ac8ef84e9e69f2`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      drawer.getByRole("link", { name: "Open request workspace", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:524:11

[apps/web/e2e/request-inbox.spec.ts:524](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:524); SHA-256 `b242140487b30e5b6a9238b3ba576e99a42db03308e8fcb156e1059815660ee7`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer.getByLabel("Message", { exact: true })).toHaveCount(0)
```

### apps/web/e2e/request-inbox.spec.ts:525:11

[apps/web/e2e/request-inbox.spec.ts:525](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:525); SHA-256 `5bd852de22abdbd1ae5c4b43d35b1f9e07127254fffd6872e3c87053a5a2fa47`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer.getByText("SR-INBOX-1", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:527:11

[apps/web/e2e/request-inbox.spec.ts:527](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:527); SHA-256 `cddb72dadd131f56b64eb351cfb797a5dbd7db0796f8ccb541c9b7cff217afbd`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer).not.toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:528:11

[apps/web/e2e/request-inbox.spec.ts:528](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:528); SHA-256 `f9b6b72f28f8d208e9ba19ccd471272cdd2fdc179349160da3ea22d36026dbb3`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      page.getByRole("button", {
        name: "Review request booking-1",
        exact: true,
      }),
    ).not.toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:538:11

[apps/web/e2e/request-inbox.spec.ts:538](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:538); SHA-256 `e96fdfc3b69cd760b08b8ea279a03fb3a529f6de874946792d8a1518bbee973e`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:542:11

[apps/web/e2e/request-inbox.spec.ts:542](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:542); SHA-256 `505ffc5c1e7bb782ef6e01e19b46552f98d380ace1acf476fb27ee82a6da07f4`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(drawer).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:546:11

[apps/web/e2e/request-inbox.spec.ts:546](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:546); SHA-256 `bb311cfac76d748b265b645134f8789d2178c4892d2f42c9600a0a50b72b4b0d`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page).toHaveURL(/\/messages\?request=booking-1$/)
```

### apps/web/e2e/request-inbox.spec.ts:547:11

[apps/web/e2e/request-inbox.spec.ts:547](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:547); SHA-256 `ff0c370d5cf45ac195e31fbd3a7aa1738d6f69634be31073b91324c79a073b05`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      page.getByRole("region", { name: "Request conversation" }),
    ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:550:11

[apps/web/e2e/request-inbox.spec.ts:550](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:550); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/request-inbox.spec.ts:555:11

[apps/web/e2e/request-inbox.spec.ts:555](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:555); SHA-256 `ae545884fd7a3df60810942447e6f092a556286465e647b9ca721e9f2f206844`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(page.getByText("No requests match this view.")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:556:5

[apps/web/e2e/request-inbox.spec.ts:556](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:556); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-212, PW-213.

All possible owners, including helper/route/hook candidates: PW-212, PW-213.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/request-inbox.spec.ts:570:9

[apps/web/e2e/request-inbox.spec.ts:570](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:570); SHA-256 `f48e4846b02212cba6f059fc69000d1537845bccaa7e95d6e5ee61c780bfbc57`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(page.getByText("Inbox temporarily unavailable.")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:577:9

[apps/web/e2e/request-inbox.spec.ts:577](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:577); SHA-256 `b65ee57944f0e394e386f6ba3a7815db9413960ed93a7c7bc303aeb291f90129`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(page.getByText("Details temporarily unavailable.")).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:578:9

[apps/web/e2e/request-inbox.spec.ts:578](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:578); SHA-256 `35f19c3a8781225e27edd39b8dca831809b6c317cecebf958097430627ffef42`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(
    page.getByRole("button", { name: "Accept request", exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-inbox.spec.ts:588:9

[apps/web/e2e/request-inbox.spec.ts:588](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:588); SHA-256 `9e64c81b5603695330855ef2251c058baa143d79a07927667861a03c515d562b`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(drawer.getByRole("alert")).toHaveText(
    "Could not save acceptance. Try again.",
  )
```

### apps/web/e2e/request-inbox.spec.ts:591:9

[apps/web/e2e/request-inbox.spec.ts:591](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:591); SHA-256 `f0aa27a14886bc15a974f113fbced81557b238c756466122a2ef8c84fdd52c2a`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(
    drawer.getByRole("button", { name: "Accept request", exact: true }),
  ).toBeEnabled()
```

### apps/web/e2e/request-inbox.spec.ts:598:9

[apps/web/e2e/request-inbox.spec.ts:598](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:598); SHA-256 `908c27426c05d9920d3a1d77bce39a93900b648ffb40fac915ae2cc03005741f`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(
    drawer.getByText(
      "Another department accepted this request. Its conversation is private to that department and the client.",
      {
        exact: true,
      },
    ),
  ).toBeVisible()
```

### apps/web/e2e/request-inbox.spec.ts:606:9

[apps/web/e2e/request-inbox.spec.ts:606](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:606); SHA-256 `129e34c25fcf7424f4f73316e5282916f2cc44159d8e42bf326a3aa290c15322`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(
    drawer.getByRole("button", { name: "Accept request", exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-inbox.spec.ts:609:3

[apps/web/e2e/request-inbox.spec.ts:609](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:609); SHA-256 `1b7de0ed9d5f829b5fb56165775977b23ca4ea24b1eba716bfafc7ce9404df80`.

Direct callback owners: PW-214.

All possible owners, including helper/route/hook candidates: PW-214.

```ts
expect(state.accepts).toBe(2)
```

### apps/web/e2e/request-inbox.spec.ts:623:11

[apps/web/e2e/request-inbox.spec.ts:623](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:623); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-215, PW-216, PW-217, PW-218.

All possible owners, including helper/route/hook candidates: PW-215, PW-216, PW-217, PW-218.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/request-inbox.spec.ts:624:11

[apps/web/e2e/request-inbox.spec.ts:624](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:624); SHA-256 `ece434b166fe6a63a8afccd6e85ffc2cf282ef40129dcb05c367bcefc0e5f88f`.

Direct callback owners: PW-215, PW-216, PW-217, PW-218.

All possible owners, including helper/route/hook candidates: PW-215, PW-216, PW-217, PW-218.

```ts
expect(
      page.getByRole("link", { name: "Request Inbox", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-inbox.spec.ts:627:5

[apps/web/e2e/request-inbox.spec.ts:627](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:627); SHA-256 `5f3ace77eae3a8d4c5f9bfb15e57449b464acfc1fb09d757274d3b836b0754e2`.

Direct callback owners: PW-215, PW-216, PW-217, PW-218.

All possible owners, including helper/route/hook candidates: PW-215, PW-216, PW-217, PW-218.

```ts
expect(state.inboxReads).toBe(0)
```

## apps/web/e2e/request-workflow.spec.ts

### apps/web/e2e/request-workflow.spec.ts:243:9

[apps/web/e2e/request-workflow.spec.ts:243](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:243); SHA-256 `a5c053537562a30296dd0351bc9347c0f3e9af0c201f024da71e21393d870268`.

Direct callback owners: PW-219.

All possible owners, including helper/route/hook candidates: PW-219.

```ts
expect.poll(() => requests).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:249:3

[apps/web/e2e/request-workflow.spec.ts:249](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:249); SHA-256 `6b822233f5d624601fb8742a8b644283d0cbf802415d20c870dfe3144d87b381`.

Direct callback owners: PW-219.

All possible owners, including helper/route/hook candidates: PW-219.

```ts
expect(requests).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:251:9

[apps/web/e2e/request-workflow.spec.ts:251](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:251); SHA-256 `d229adf8bf35660e105788581286ed2333379d25add1d71db4214a681d011d6f`.

Direct callback owners: PW-219.

All possible owners, including helper/route/hook candidates: PW-219.

```ts
expect.poll(() => requests).toBe(2)
```

### apps/web/e2e/request-workflow.spec.ts:252:9

[apps/web/e2e/request-workflow.spec.ts:252](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:252); SHA-256 `163dd7c2b68221e09e8639d3b47ee49b6f6df4c773ffaf38d6ba89d4614c0572`.

Direct callback owners: PW-219.

All possible owners, including helper/route/hook candidates: PW-219.

```ts
expect(
    page.getByLabel("Quotation reference").getByRole("definition"),
  ).toHaveText("REQ-2026-1001")
```

### apps/web/e2e/request-workflow.spec.ts:255:3

[apps/web/e2e/request-workflow.spec.ts:255](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:255); SHA-256 `4f6d335bcb51b927d0a24aa5d9131386d2c566c29b4be6b0f693229ed38ffbd9`.

Direct callback owners: PW-219.

All possible owners, including helper/route/hook candidates: PW-219.

```ts
expect(maximumActive).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:272:13

[apps/web/e2e/request-workflow.spec.ts:272](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:272); SHA-256 `2f1ab0f864155cba0b6039c9071df32478acfa66841cdbb5e16661fe71ce26a1`.

Direct callback owners: PW-220, PW-221, PW-222, PW-223.

All possible owners, including helper/route/hook candidates: PW-220, PW-221, PW-222, PW-223.

```ts
expect(reference).toHaveText("REQ-2026-1001")
```

### apps/web/e2e/request-workflow.spec.ts:273:13

[apps/web/e2e/request-workflow.spec.ts:273](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:273); SHA-256 `03bb76b8b0ea6ae4779f285b43eef414e4004a9a4dd03ffd1b860237da83c613`.

Direct callback owners: PW-220, PW-221, PW-222, PW-223.

All possible owners, including helper/route/hook candidates: PW-220, PW-221, PW-222, PW-223.

```ts
expect(reference).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:275:13

[apps/web/e2e/request-workflow.spec.ts:275](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:275); SHA-256 `2f1ab0f864155cba0b6039c9071df32478acfa66841cdbb5e16661fe71ce26a1`.

Direct callback owners: PW-220, PW-221, PW-222, PW-223.

All possible owners, including helper/route/hook candidates: PW-220, PW-221, PW-222, PW-223.

```ts
expect(reference).toHaveText("REQ-2026-1001")
```

### apps/web/e2e/request-workflow.spec.ts:287:9

[apps/web/e2e/request-workflow.spec.ts:287](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:287); SHA-256 `439a87d190e094cef97a1cfff37d46398034ec9f07102bdce5a78fb778902b5e`.

Direct callback owners: PW-224.

All possible owners, including helper/route/hook candidates: PW-224.

```ts
expect(
    page.getByLabel("Quotation reference").getByRole("definition"),
  ).toHaveText("request-1")
```

### apps/web/e2e/request-workflow.spec.ts:298:9

[apps/web/e2e/request-workflow.spec.ts:298](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:298); SHA-256 `e3fa4f0b94a2d3334053d5d6563acc4d803ecbdef9527aeecdd2a87c0c1932f8`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page
      .getByRole("complementary", { name: "Request context" })
      .getByRole("button", { name: /Website Development REQ-2026-1001/ }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:309:9

[apps/web/e2e/request-workflow.spec.ts:309](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:309); SHA-256 `e7039f39d2ad40b6db98b473fb30f1cfbea3933911d34d14d5ed8701e9c1271d`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByRole("heading", { name: "Quotation formally accepted" }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:312:9

[apps/web/e2e/request-workflow.spec.ts:312](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:312); SHA-256 `fdb0235890568a5ae7845521705dba45eb46d88ed583abb6e855801e5884cd9a`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByRole("heading", { name: "Payment requirement", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:315:9

[apps/web/e2e/request-workflow.spec.ts:315](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:315); SHA-256 `7d12aee509b12e49e98b830cac61c209595fdfa200379f977840cd3f0654ba09`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByText(/Xendit sandbox prototype · no real charge will be made/),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:318:9

[apps/web/e2e/request-workflow.spec.ts:318](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:318); SHA-256 `24161a1c3ac7d5ef32f1678eaa136b3aeddd950976cce6637268b2b63dd41582`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByRole("heading", { name: "Service agreement", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:321:9

[apps/web/e2e/request-workflow.spec.ts:321](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:321); SHA-256 `c8037fd01f042ef8f58d1e5ff45aee36dfc3da981b9bb64324a722d7d6d4b351`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByText(/No separate signature is required/),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:329:9

[apps/web/e2e/request-workflow.spec.ts:329](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:329); SHA-256 `d2e12f437b626693943196cce9400b8bc15ed41fc650f2f7eed6f2398d3575f2`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(checklist.getByRole("link", { name: /Agreement/ })).toHaveCount(
    0,
  )
```

### apps/web/e2e/request-workflow.spec.ts:332:9

[apps/web/e2e/request-workflow.spec.ts:332](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:332); SHA-256 `607c99ec1d0ff66934132c7780684f8326eab7f4a19f7ec65f89a6dc69e70d60`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByRole("button", { name: "Submit signed agreement", exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:335:3

[apps/web/e2e/request-workflow.spec.ts:335](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:335); SHA-256 `c68bfb487368fe68ce90e28addf63577435ef06def6994a89c801c938d259b44`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(actions).toHaveLength(1)
```

### apps/web/e2e/request-workflow.spec.ts:336:3

[apps/web/e2e/request-workflow.spec.ts:336](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:336); SHA-256 `50444593b86735a90c678f78011f337a86a90909276d229d52111f6f5d4b8bec`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(actions[0]).toMatchObject({
    type: "RESPOND_QUOTATION",
    quotationId: "quote-1",
    decision: "ACCEPT",
    expectedVersion: 3,
  })
```

### apps/web/e2e/request-workflow.spec.ts:342:3

[apps/web/e2e/request-workflow.spec.ts:342](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:342); SHA-256 `e9703f83cf34f0e7db9e18f876cceef97bf8418da64086be1ddaf3654727c05f`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(actions[0]!.actionId).toMatch(/^[0-9a-f-]{36}$/)
```

### apps/web/e2e/request-workflow.spec.ts:343:9

[apps/web/e2e/request-workflow.spec.ts:343](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:343); SHA-256 `5b72f51cb9aa13b56b9a9537f83480fee8055d979d668cc00f304f2cb2defaec`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(page.getByText("Internal · Department head only")).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:344:9

[apps/web/e2e/request-workflow.spec.ts:344](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:344); SHA-256 `fb468531811141bf573d42f4dbdd17e0bb814509553d3ec1e143b21bc45d0db1`.

Direct callback owners: PW-225.

All possible owners, including helper/route/hook candidates: PW-225.

```ts
expect(
    page.getByRole("button", { name: "Activate project", exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:389:7

[apps/web/e2e/request-workflow.spec.ts:389](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:389); SHA-256 `aaf4a1b30de6f4050d2179271fec6c58875c0ed15b8dd8353e1818eebccc0728`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(route.request().postDataJSON()).toMatchObject({
        name: "brief.txt",
        mimeType: "text/plain",
        contextual: true,
      })
```

### apps/web/e2e/request-workflow.spec.ts:416:3

[apps/web/e2e/request-workflow.spec.ts:416](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:416); SHA-256 `10b28d59049a980a5df252bc0fb22f66b90ed2d8a00717604c81194b6ca33d5c`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(row).not.toBeNull()
```

### apps/web/e2e/request-workflow.spec.ts:417:3

[apps/web/e2e/request-workflow.spec.ts:417](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:417); SHA-256 `7bc7b4361e8e2cbfa2a0061b138a5de9f5bd78a871ce34d21870d5cb28216176`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(button).not.toBeNull()
```

### apps/web/e2e/request-workflow.spec.ts:418:3

[apps/web/e2e/request-workflow.spec.ts:418](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:418); SHA-256 `63f1ce6b009ac92a7d96d8fe7e7fdeffa4407891d5afeec270994b18d85c13ec`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(row!.x + row!.width).toBeGreaterThan(button!.x + button!.width + 8)
```

### apps/web/e2e/request-workflow.spec.ts:426:3

[apps/web/e2e/request-workflow.spec.ts:426](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:426); SHA-256 `edf27193d0694e74bfe0e75218f2da16c811180876b4bd04c80fbd16e880a6fb`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(await outsidePicker).toBeNull()
```

### apps/web/e2e/request-workflow.spec.ts:435:9

[apps/web/e2e/request-workflow.spec.ts:435](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:435); SHA-256 `ce085a32030747ff94f53eebac983bb10dfe7cfcd13c6452a850f69d9375124d`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(page.getByText(/Ready to submit/)).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:436:3

[apps/web/e2e/request-workflow.spec.ts:436](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:436); SHA-256 `25dbb8d487f33a68a006d73cb5feedd8f64194509a7d047a9be656b2196fb9c8`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(workflow.files).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:437:3

[apps/web/e2e/request-workflow.spec.ts:437](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:437); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:441:9

[apps/web/e2e/request-workflow.spec.ts:441](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:441); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:442:3

[apps/web/e2e/request-workflow.spec.ts:442](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:442); SHA-256 `e6726f8495b9220fc0c7e4809d341e70de86dfb79df99a405cabe2113d472530`.

Direct callback owners: PW-226.

All possible owners, including helper/route/hook candidates: PW-226.

```ts
expect(actions[0]).toMatchObject({
    type: "SUBMIT_REQUIREMENT",
    requirementId: "requirement-1",
    fileIds: ["uploaded-brief"],
    expectedVersion: 4,
  })
```

### apps/web/e2e/request-workflow.spec.ts:471:9

[apps/web/e2e/request-workflow.spec.ts:471](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:471); SHA-256 `1db9bc2d8311b3ff9bed319f410304095e2dc5ac6427bbb5c6fdc569dcfa679e`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(body.contextual).toBe(true)
```

### apps/web/e2e/request-workflow.spec.ts:516:11

[apps/web/e2e/request-workflow.spec.ts:516](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:516); SHA-256 `cc5bb6879835bac145705d681d8681efb6f55315acd81a285730a92cadd21883`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(
      page.getByText("Attach up to 5 files per response", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:519:5

[apps/web/e2e/request-workflow.spec.ts:519](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:519); SHA-256 `4e7c59350ab4839895d2180da3e6b195c83e6b8effd8b3e3c737dafb8ae74638`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(attempts).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:521:11

[apps/web/e2e/request-workflow.spec.ts:521](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:521); SHA-256 `42b0cba3c3a14bf033c7271876e20ef963901b0d864b5fbf10a609d93ff03e60`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(page.getByText(/2\/5 files/)).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:525:11

[apps/web/e2e/request-workflow.spec.ts:525](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:525); SHA-256 `c97d9509d288c1b0c5168f0fa12b012daf8dba6661db23e697e35d6d7af19de8`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(page.getByText(/1\/5 files/)).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:527:11

[apps/web/e2e/request-workflow.spec.ts:527](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:527); SHA-256 `4fb014f77f578181aed0daf3d10e00e4a7ba007a09741d760b6e79b03393c52f`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(page.getByText(/5\/5 files/)).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:528:11

[apps/web/e2e/request-workflow.spec.ts:528](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:528); SHA-256 `d892ba081057d0cb11d2be6d280847b361401174a85ffaf361d93c30564ca471`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(
      page.getByRole("button", { name: "Add documents", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:531:5

[apps/web/e2e/request-workflow.spec.ts:531](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:531); SHA-256 `4e7c59350ab4839895d2180da3e6b195c83e6b8effd8b3e3c737dafb8ae74638`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(attempts).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:537:11

[apps/web/e2e/request-workflow.spec.ts:537](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:537); SHA-256 `4e23af11b0a18a121ad7cc32f84f26a7276ddcfde299b9ab62be238ff00b1e46`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect.poll(() => attempts.length).toBe(2)
```

### apps/web/e2e/request-workflow.spec.ts:538:11

[apps/web/e2e/request-workflow.spec.ts:538](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:538); SHA-256 `9c144b505151a81913b3e2bb0a784f956979490c96247b4649d66d8dc34d063f`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(submit).toBeEnabled()
```

### apps/web/e2e/request-workflow.spec.ts:539:5

[apps/web/e2e/request-workflow.spec.ts:539](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:539); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:540:11

[apps/web/e2e/request-workflow.spec.ts:540](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:540); SHA-256 `9146a23d4ee54b32b7d8d710eabdd40fa0e64a6a66cd084f3fc04d02fdd6f8f8`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(
      page.getByRole("button", { name: "Remove support-1.txt", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:544:11

[apps/web/e2e/request-workflow.spec.ts:544](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:544); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:545:11

[apps/web/e2e/request-workflow.spec.ts:545](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:545); SHA-256 `9c144b505151a81913b3e2bb0a784f956979490c96247b4649d66d8dc34d063f`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(submit).toBeEnabled()
```

### apps/web/e2e/request-workflow.spec.ts:546:5

[apps/web/e2e/request-workflow.spec.ts:546](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:546); SHA-256 `e0cdbb625f0e8c2537eb43b1f5fea5f84cba0b83608bc00e052c0fab83f5e913`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(attempts).toHaveLength(6)
```

### apps/web/e2e/request-workflow.spec.ts:548:11

[apps/web/e2e/request-workflow.spec.ts:548](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:548); SHA-256 `ea991fa5c92b858da0c5b6dcb9c4dcbfd365b478aea78d5f05b7a9e280ac3613`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect.poll(() => actions.length).toBe(2)
```

### apps/web/e2e/request-workflow.spec.ts:549:5

[apps/web/e2e/request-workflow.spec.ts:549](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:549); SHA-256 `e0cdbb625f0e8c2537eb43b1f5fea5f84cba0b83608bc00e052c0fab83f5e913`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(attempts).toHaveLength(6)
```

### apps/web/e2e/request-workflow.spec.ts:550:5

[apps/web/e2e/request-workflow.spec.ts:550](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:550); SHA-256 `e4c5ded6af81475e731e0743048a5260b28c80df1c99321e3c94988150a19857`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(actions[1]).toEqual(actions[0])
```

### apps/web/e2e/request-workflow.spec.ts:551:5

[apps/web/e2e/request-workflow.spec.ts:551](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:551); SHA-256 `1b2dd70f39af94bbf97c2b943415330ca3299e5df770dd500b2ca24c9484012d`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(actions[1]).toMatchObject({
      type: "SUBMIT_REQUIREMENT",
      fileIds: documents.slice(0, 5).map((file) => `uploaded-${file.name}`),
    })
```

### apps/web/e2e/request-workflow.spec.ts:556:13

[apps/web/e2e/request-workflow.spec.ts:556](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:556); SHA-256 `e2ad8a62311bf5629bb6d6094d02a6583fdd1e0e84a7cc77919d252363c861c8`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(
        page.getByRole("button", {
          name: `Download ${file.name}`,
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:564:13

[apps/web/e2e/request-workflow.spec.ts:564](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:564); SHA-256 `e2ad8a62311bf5629bb6d6094d02a6583fdd1e0e84a7cc77919d252363c861c8`.

Direct callback owners: PW-227, PW-228.

All possible owners, including helper/route/hook candidates: PW-227, PW-228.

```ts
expect(
        page.getByRole("button", {
          name: `Download ${file.name}`,
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:619:9

[apps/web/e2e/request-workflow.spec.ts:619](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:619); SHA-256 `d1dd501cd4ad63dd965c334f27c21124b8e23e23dca3c8df97a37d316f7fbf06`.

Direct callback owners: PW-229.

All possible owners, including helper/route/hook candidates: PW-229.

```ts
expect(checklist.getByText("Completed", { exact: true })).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:620:9

[apps/web/e2e/request-workflow.spec.ts:620](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:620); SHA-256 `875630107b3e83e937e2f2e79204af6dd907addbf16219ae220ec9235500373d`.

Direct callback owners: PW-229.

All possible owners, including helper/route/hook candidates: PW-229.

```ts
expect(checklist.getByText("Pending", { exact: true })).toHaveCSS(
    "color",
    "rgb(180, 35, 24)",
  )
```

### apps/web/e2e/request-workflow.spec.ts:624:9

[apps/web/e2e/request-workflow.spec.ts:624](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:624); SHA-256 `d2e12f437b626693943196cce9400b8bc15ed41fc650f2f7eed6f2398d3575f2`.

Direct callback owners: PW-229.

All possible owners, including helper/route/hook candidates: PW-229.

```ts
expect(checklist.getByRole("link", { name: /Agreement/ })).toHaveCount(
    0,
  )
```

### apps/web/e2e/request-workflow.spec.ts:627:9

[apps/web/e2e/request-workflow.spec.ts:627](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:627); SHA-256 `e00b5a5e6a9209ea05a5822806131e909c65f605ef838245b5db15fbed045cfb`.

Direct callback owners: PW-229.

All possible owners, including helper/route/hook candidates: PW-229.

```ts
expect(
    page.getByRole("button", {
      name: "Attach agreement document",
      exact: true,
    }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:633:9

[apps/web/e2e/request-workflow.spec.ts:633](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:633); SHA-256 `c8037fd01f042ef8f58d1e5ff45aee36dfc3da981b9bb64324a722d7d6d4b351`.

Direct callback owners: PW-229.

All possible owners, including helper/route/hook candidates: PW-229.

```ts
expect(
    page.getByText(/No separate signature is required/),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:659:3

[apps/web/e2e/request-workflow.spec.ts:659](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:659); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-230.

All possible owners, including helper/route/hook candidates: PW-230.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:662:3

[apps/web/e2e/request-workflow.spec.ts:662](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:662); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-230.

All possible owners, including helper/route/hook candidates: PW-230.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:667:9

[apps/web/e2e/request-workflow.spec.ts:667](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:667); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-230.

All possible owners, including helper/route/hook candidates: PW-230.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:668:3

[apps/web/e2e/request-workflow.spec.ts:668](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:668); SHA-256 `05235714b010ca86f4c7ae09e298d3b36ccdcabe9ba06b93a85e9d3082c8f6c9`.

Direct callback owners: PW-230.

All possible owners, including helper/route/hook candidates: PW-230.

```ts
expect(actions[0]).toMatchObject({
    type: "REQUEST_REQUIREMENT",
    details: "Please attach the project brief.",
  })
```

### apps/web/e2e/request-workflow.spec.ts:698:11

[apps/web/e2e/request-workflow.spec.ts:698](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:698); SHA-256 `dc99fd7e575f1a2f33cee237c733a8d99f819e8f428eedf7ae3d656d8acfbb1d`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      page.getByRole("dialog", { name: "Create quotation", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:703:11

[apps/web/e2e/request-workflow.spec.ts:703](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:703); SHA-256 `12855b619426065f8b16847d45c327d25a081e2145dfc08d23ed9d727537722d`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(message).toHaveValue(
      "Quotation details stay connected to this chat.",
    )
```

### apps/web/e2e/request-workflow.spec.ts:710:5

[apps/web/e2e/request-workflow.spec.ts:710](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:710); SHA-256 `b26635bb44fa8865b1456829838c5fdfe3b2ac9e868a07a67c158740d3b54f2a`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      Math.abs(composerBox!.y - (sheetBox!.y + sheetBox!.height) - 8),
    ).toBeLessThan(2)
```

### apps/web/e2e/request-workflow.spec.ts:713:5

[apps/web/e2e/request-workflow.spec.ts:713](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:713); SHA-256 `4ffb2a134a607a94a04f133c5d6b839ce31751412e3dabf53b0d82f91cc99917`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(sheetBox!.height).toBeLessThanOrEqual(400)
```

### apps/web/e2e/request-workflow.spec.ts:715:11

[apps/web/e2e/request-workflow.spec.ts:715](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:715); SHA-256 `6334d1a39536a64170a72a9101c8ae0e3e732057d7da0ab43a81284a8f468cf6`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(details).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:718:11

[apps/web/e2e/request-workflow.spec.ts:718](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:718); SHA-256 `8eaf3a9005d6a58362ab089347c0ec16efb9ca27cffd3dc4b1346d75825db754`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(deliverables).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:719:11

[apps/web/e2e/request-workflow.spec.ts:719](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:719); SHA-256 `b2caf5b62d64d2a016b0f7f6a8c71f039fddc12da8f2eaf1175e5c619d92dceb`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(deliverables).toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/request-workflow.spec.ts:720:11

[apps/web/e2e/request-workflow.spec.ts:720](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:720); SHA-256 `d2aba6301e59805431c575fbe9743dec45438570da6a199a2e1c64d33fdeaed2`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(deliverables).toHaveAccessibleDescription(
      "Complete this field.",
    )
```

### apps/web/e2e/request-workflow.spec.ts:723:11

[apps/web/e2e/request-workflow.spec.ts:723](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:723); SHA-256 `684c401c476666bb8a503bfc5a0c2d0bbecae5c95c52ac33a00f813e04304710`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.locator("[data-field-error]")).toHaveText(
      "Complete this field.",
    )
```

### apps/web/e2e/request-workflow.spec.ts:726:11

[apps/web/e2e/request-workflow.spec.ts:726](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:726); SHA-256 `24595e6396dc20bbc17168667c49e780bb50e03679e83cf39acd192da8a238ae`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.locator("form")).toHaveAttribute("novalidate", "")
```

### apps/web/e2e/request-workflow.spec.ts:727:5

[apps/web/e2e/request-workflow.spec.ts:727](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:727); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:731:11

[apps/web/e2e/request-workflow.spec.ts:731](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:731); SHA-256 `621178e0c66f0cef7c0362ec345b343b59c29291dcb1d8e9111e02d770461cc2`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(deliverables).not.toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/request-workflow.spec.ts:732:11

[apps/web/e2e/request-workflow.spec.ts:732](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:732); SHA-256 `b4ec646dbf158ad09839df4eea0311479e3f19f963074a8772eeaf0b68938260`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.locator("[data-field-error]")).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:736:11

[apps/web/e2e/request-workflow.spec.ts:736](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:736); SHA-256 `ab15656e066a1b6552be4e8958be063c18c44273f89c23723c87f8c55da98c90`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:740:11

[apps/web/e2e/request-workflow.spec.ts:740](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:740); SHA-256 `6334d1a39536a64170a72a9101c8ae0e3e732057d7da0ab43a81284a8f468cf6`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(details).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:741:11

[apps/web/e2e/request-workflow.spec.ts:741](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:741); SHA-256 `2bec0baaeb9561d2d47ba2354f9f75df504770df78a2fdbdc577f635e8be2754`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.getByLabel("Deliverables (one per line)")).toHaveValue(
      "Accessible website\nProduction deployment",
    )
```

### apps/web/e2e/request-workflow.spec.ts:746:11

[apps/web/e2e/request-workflow.spec.ts:746](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:746); SHA-256 `8c7997e23b3123017e3e9e31a239ea9fea4bcb598ff546ab75e56e16ea14e80f`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      page.getByRole("option", { name: "USD · US Dollar", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:754:11

[apps/web/e2e/request-workflow.spec.ts:754](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:754); SHA-256 `d6e237dfd0c4bf876edf26ea6c501ba30da5fc952b1fa281982b1d5404a14b88`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(item).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:755:11

[apps/web/e2e/request-workflow.spec.ts:755](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:755); SHA-256 `be62c92f09e6db28d6d9c516b687d303e62b079324df71083f6c40898a2a2f5a`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(item).toHaveAccessibleDescription("Complete this field.")
```

### apps/web/e2e/request-workflow.spec.ts:756:11

[apps/web/e2e/request-workflow.spec.ts:756](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:756); SHA-256 `419cb003e59b145c7206d58e644f9dfea048f6e663f7e82f0b10c0b004ea586f`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(item).toBeInViewport()
```

### apps/web/e2e/request-workflow.spec.ts:757:11

[apps/web/e2e/request-workflow.spec.ts:757](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:757); SHA-256 `56e0bf82742d7989c858ca6092c957850d5514df8c4085f2cf6010b68081b7c7`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.locator("[data-field-error]")).toBeInViewport()
```

### apps/web/e2e/request-workflow.spec.ts:758:11

[apps/web/e2e/request-workflow.spec.ts:758](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:758); SHA-256 `23b92a0d1b19a8cdc62ab7419f8aeebfb6b65c45ccbb08f7a0ebe1b904496506`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect
      .poll(() =>
        draft.locator("[data-field-error]").evaluate((element) => {
          const box = element.getBoundingClientRect()
          return (
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ) === element
          )
        }),
      )
      .toBe(true)
```

### apps/web/e2e/request-workflow.spec.ts:781:11

[apps/web/e2e/request-workflow.spec.ts:781](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:781); SHA-256 `ff7ab2367e406bbb24a532d54216afd307391551511d3ea90fb569545fc30dab`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(quantity).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:782:11

[apps/web/e2e/request-workflow.spec.ts:782](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:782); SHA-256 `1fa947a726fccae127b80e34a2600b5da2ae3f624b497e99c2a269ad936c52aa`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(quantity).toHaveAccessibleDescription(
      "Enter a value of 1 or more.",
    )
```

### apps/web/e2e/request-workflow.spec.ts:788:11

[apps/web/e2e/request-workflow.spec.ts:788](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:788); SHA-256 `8499de7f2f47230afa58dc4f351d69c4412ae388316855287382f8a0021485f1`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(price).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:789:11

[apps/web/e2e/request-workflow.spec.ts:789](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:789); SHA-256 `a7219dc332d2c301b9abd636a9ce279e542755bdecb97b7e1fcd5100cfbdbdbd`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(price).toHaveAccessibleDescription("Complete this field.")
```

### apps/web/e2e/request-workflow.spec.ts:791:11

[apps/web/e2e/request-workflow.spec.ts:791](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:791); SHA-256 `bf8e6200aaa6645ecd03b2e10e1a33d68b75dcaa6f9b40b4f10e6242719f4b49`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(price).toHaveValue("1,234,567.89")
```

### apps/web/e2e/request-workflow.spec.ts:792:11

[apps/web/e2e/request-workflow.spec.ts:792](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:792); SHA-256 `b4ec646dbf158ad09839df4eea0311479e3f19f963074a8772eeaf0b68938260`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.locator("[data-field-error]")).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:801:11

[apps/web/e2e/request-workflow.spec.ts:801](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:801); SHA-256 `b9ea6b6fc28451bda47286ce51fcd7ee9e6ec3a1ad28ed6f3d245318ddb8db71`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(amount).toHaveValue("1,234.5")
```

### apps/web/e2e/request-workflow.spec.ts:803:11

[apps/web/e2e/request-workflow.spec.ts:803](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:803); SHA-256 `7b2ec8e5e6b06d281da921b7a458e36dbbb09bf32298eab89191971b446945a5`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.getByRole("alert")).toContainText(
      "Choose a future validity date",
    )
```

### apps/web/e2e/request-workflow.spec.ts:806:11

[apps/web/e2e/request-workflow.spec.ts:806](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:806); SHA-256 `4d65b00a10c669866c021423e203fd113e728fa3bdcc3f5dfd8880c39a365f0f`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(amount).toHaveValue("1,234.50")
```

### apps/web/e2e/request-workflow.spec.ts:813:5

[apps/web/e2e/request-workflow.spec.ts:813](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:813); SHA-256 `64517831694f2f4ffbd7a7873471801d798c41cc0ecd28f2639c3787c5240f11`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      Math.abs(amountBox!.y + amountBox!.height - dateBox!.y - dateBox!.height),
    ).toBeLessThan(1)
```

### apps/web/e2e/request-workflow.spec.ts:816:5

[apps/web/e2e/request-workflow.spec.ts:816](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:816); SHA-256 `4e7fd30d7664da7bb7588f48b45df4beb7380b4c030140bb4cc18081080a7300`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(Math.abs(amountBox!.height - dateBox!.height)).toBeLessThan(1)
```

### apps/web/e2e/request-workflow.spec.ts:817:5

[apps/web/e2e/request-workflow.spec.ts:817](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:817); SHA-256 `e696430440b2480e05c40ee7e7af7ed2d10a001cb495e0f6e31b2ffb234cba4f`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(Math.abs(amountBox!.width - dateBox!.width)).toBeLessThan(1)
```

### apps/web/e2e/request-workflow.spec.ts:818:11

[apps/web/e2e/request-workflow.spec.ts:818](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:818); SHA-256 `68a3dfef0b1d296b4f8046349cfb6442772f53f9f4f6baf45e99811f894364e0`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(validity).toHaveText("Select date & time")
```

### apps/web/e2e/request-workflow.spec.ts:819:5

[apps/web/e2e/request-workflow.spec.ts:819](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:819); SHA-256 `c54a29f1c5442e07d58dd198a5c3b467be70fe0dc6b509c283b9aec2a74c38b0`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(dateBox!.x).toBeGreaterThan(amountBox!.x + amountBox!.width)
```

### apps/web/e2e/request-workflow.spec.ts:825:11

[apps/web/e2e/request-workflow.spec.ts:825](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:825); SHA-256 `d3843e6b76e822df7907cb66d7c23f4461119529143704adab4a479d3689ddd4`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      picker.getByRole("button", { name: "Previous month", exact: true }),
    ).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:828:11

[apps/web/e2e/request-workflow.spec.ts:828](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:828); SHA-256 `c8e42c1d549f0021763a07c9187075ca17cea8d1b4adc47337a66dde15b186cf`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      picker.getByRole("button", {
        name: "Sunday, November 1, 2026",
        exact: true,
      }),
    ).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:849:11

[apps/web/e2e/request-workflow.spec.ts:849](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:849); SHA-256 `2fb306f654acd536fd82ddfdef6ace05b2e897a89625d38beea86341da890101`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(picker).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:850:11

[apps/web/e2e/request-workflow.spec.ts:850](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:850); SHA-256 `a0a4ad49fa764b030ca9160a3e404b19992c1f82ac05b67d95f6e363b8ac95dc`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(validity).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:851:11

[apps/web/e2e/request-workflow.spec.ts:851](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:851); SHA-256 `f1097c392daa16bf62c26618f92ed03a6a33051000b85a51dec05da61c08b666`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(validity).toHaveAttribute("title", /November 20, 2026/)
```

### apps/web/e2e/request-workflow.spec.ts:852:11

[apps/web/e2e/request-workflow.spec.ts:852](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:852); SHA-256 `3832c76e1d55ee124fa3cd37d20d1cb3174b18a29e5d41182a1946fb7f5987b4`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(draft.locator('input[name="validUntil"]')).toHaveValue(
      "2026-11-20T09:30",
    )
```

### apps/web/e2e/request-workflow.spec.ts:859:11

[apps/web/e2e/request-workflow.spec.ts:859](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:859); SHA-256 `0c1dedd34344902149978cf8f58c5d176ce77f691281b47accedc2eaea884b57`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      draft.getByRole("region", { name: "Quotation review" }),
    ).toContainText("1,234,567.89")
```

### apps/web/e2e/request-workflow.spec.ts:865:11

[apps/web/e2e/request-workflow.spec.ts:865](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:865); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:866:5

[apps/web/e2e/request-workflow.spec.ts:866](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:866); SHA-256 `04169754e04b647827eb095721e972ffe22bb58d9a0b116954fc168cb99ac13c`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(actions[0]).toMatchObject({
      type: "CREATE_QUOTATION",
      currency: "USD",
      lineItems: [
        {
          description: "Website delivery",
          quantity: 1,
          unitPrice: "1234567.89",
        },
      ],
      paymentDue: "1234.50",
    })
```

### apps/web/e2e/request-workflow.spec.ts:878:5

[apps/web/e2e/request-workflow.spec.ts:878](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:878); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-231, PW-233.

All possible owners, including helper/route/hook candidates: PW-231, PW-233.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/request-workflow.spec.ts:917:11

[apps/web/e2e/request-workflow.spec.ts:917](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:917); SHA-256 `847d9954f85dbc2158abd74ded4ae94f5d2d24e1aa46a2152ba67b188eb98a9a`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(draft.getByLabel("Service scope")).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:922:11

[apps/web/e2e/request-workflow.spec.ts:922](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:922); SHA-256 `24cbeb2eee61de7171f0217224d8440902c35818eb5503f60075f4170c5b2237`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(draft.getByLabel("Item 1", { exact: true })).toHaveValue(
      "Website delivery",
    )
```

### apps/web/e2e/request-workflow.spec.ts:925:11

[apps/web/e2e/request-workflow.spec.ts:925](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:925); SHA-256 `39bc6b032d6a7662eb1e04a2c63eee55ef46d8b90f7919d23295e3f8d3b69d07`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(draft.getByLabel("Item 2", { exact: true })).toHaveValue(
      "Hosting",
    )
```

### apps/web/e2e/request-workflow.spec.ts:931:11

[apps/web/e2e/request-workflow.spec.ts:931](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:931); SHA-256 `388897ed0d8a9ddb23fe492694a2d996e3125a4df0f7a800ae2ea3ee1c935b29`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(draft.getByLabel("Item 2", { exact: true })).toHaveValue(
      "Managed hosting",
    )
```

### apps/web/e2e/request-workflow.spec.ts:944:11

[apps/web/e2e/request-workflow.spec.ts:944](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:944); SHA-256 `4f761b132df9108b8f21e2b7b0c5cca56a551053425821074de55b3093fe4e3f`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(validity).toHaveValue(validUntil)
```

### apps/web/e2e/request-workflow.spec.ts:947:11

[apps/web/e2e/request-workflow.spec.ts:947](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:947); SHA-256 `4bfee744383bbfaa64b252c4f37f88fbec5f8ef6a6a4855cca52b10aa84ebae7`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(
      draft.getByLabel("Amount due before commencement"),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:952:11

[apps/web/e2e/request-workflow.spec.ts:952](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:952); SHA-256 `4bfee744383bbfaa64b252c4f37f88fbec5f8ef6a6a4855cca52b10aa84ebae7`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(
      draft.getByLabel("Amount due before commencement"),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:957:11

[apps/web/e2e/request-workflow.spec.ts:957](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:957); SHA-256 `f9dc631a3426ed1f224efe9efdc2824e0ed176b24c63c9f438fff33b34854cfd`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(
      draft.getByRole("region", { name: "Quotation review" }),
    ).toContainText("Managed hosting")
```

### apps/web/e2e/request-workflow.spec.ts:964:5

[apps/web/e2e/request-workflow.spec.ts:964](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:964); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:966:11

[apps/web/e2e/request-workflow.spec.ts:966](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:966); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:967:5

[apps/web/e2e/request-workflow.spec.ts:967](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:967); SHA-256 `3e3f6e78e9c8d9f337514f55883889b72e7c0deaafed7a1564472526de69003c`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(actions[0]!.lineItems).toEqual([
      { description: "Website delivery", quantity: 1, unitPrice: "25000.00" },
      { description: "Managed hosting", quantity: 2, unitPrice: "500.00" },
    ])
```

### apps/web/e2e/request-workflow.spec.ts:971:5

[apps/web/e2e/request-workflow.spec.ts:971](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:971); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-232, PW-234.

All possible owners, including helper/route/hook candidates: PW-232, PW-234.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/request-workflow.spec.ts:991:9

[apps/web/e2e/request-workflow.spec.ts:991](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:991); SHA-256 `503826a2018dc807717e939e1ac449de012a3f07e79519957b561495bef07519`.

Direct callback owners: PW-235.

All possible owners, including helper/route/hook candidates: PW-235.

```ts
expect(dialog).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:992:3

[apps/web/e2e/request-workflow.spec.ts:992](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:992); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-235.

All possible owners, including helper/route/hook candidates: PW-235.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:994:9

[apps/web/e2e/request-workflow.spec.ts:994](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:994); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-235.

All possible owners, including helper/route/hook candidates: PW-235.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:995:3

[apps/web/e2e/request-workflow.spec.ts:995](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:995); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-235.

All possible owners, including helper/route/hook candidates: PW-235.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:1002:9

[apps/web/e2e/request-workflow.spec.ts:1002](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1002); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-235.

All possible owners, including helper/route/hook candidates: PW-235.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:1003:3

[apps/web/e2e/request-workflow.spec.ts:1003](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1003); SHA-256 `09b24e18faebf86a145f1a59ed9ea7a16ff4f815479360d5e34414f48f637cbb`.

Direct callback owners: PW-235.

All possible owners, including helper/route/hook candidates: PW-235.

```ts
expect(actions[0]).toMatchObject({ decision: "DECLINE" })
```

### apps/web/e2e/request-workflow.spec.ts:1055:3

[apps/web/e2e/request-workflow.spec.ts:1055](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1055); SHA-256 `622093e032d5f29302740eeecf0c9d2ebef67d47629a23568df1a8051f5f3721`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect(actions).toHaveLength(0)
```

### apps/web/e2e/request-workflow.spec.ts:1056:9

[apps/web/e2e/request-workflow.spec.ts:1056](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1056); SHA-256 `35ec74b490aa2110a51a357c823ffe75e0f05a462ce80005042bf461e72be879`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect(page.locator("[data-field-error]")).toHaveText(
    "Enter a reason for rejecting this payment.",
  )
```

### apps/web/e2e/request-workflow.spec.ts:1059:9

[apps/web/e2e/request-workflow.spec.ts:1059](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1059); SHA-256 `7521496a98ffe5fa6e203ecf837420b33d044365e2431fd9724443aa4cf6b5fd`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect(
    page.getByRole("textbox", { name: "Verification note", exact: true }),
  ).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:1068:9

[apps/web/e2e/request-workflow.spec.ts:1068](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1068); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:1069:3

[apps/web/e2e/request-workflow.spec.ts:1069](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1069); SHA-256 `3453c17fda2cdd0e91d6bacdd685002d65a0b796f4d9a2324a58b6ac1eca107f`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect(actions[0]).toMatchObject({
    type: "VERIFY_PAYMENT",
    approve: false,
    note: "Receipt does not match the amount",
  })
```

### apps/web/e2e/request-workflow.spec.ts:1074:9

[apps/web/e2e/request-workflow.spec.ts:1074](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1074); SHA-256 `e5365e71c59afca273d3786468fa4ef15717dd8959ff3b2c592fb030b8b6969f`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect(
    page.getByRole("button", { name: "Confirm payment", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1081:9

[apps/web/e2e/request-workflow.spec.ts:1081](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1081); SHA-256 `ea991fa5c92b858da0c5b6dcb9c4dcbfd365b478aea78d5f05b7a9e280ac3613`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect.poll(() => actions.length).toBe(2)
```

### apps/web/e2e/request-workflow.spec.ts:1082:3

[apps/web/e2e/request-workflow.spec.ts:1082](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1082); SHA-256 `e66da06275db1252845c477f31330662cb6abdc2e0255f4e5b5db81089f9af98`.

Direct callback owners: PW-236.

All possible owners, including helper/route/hook candidates: PW-236.

```ts
expect(actions[1]).toMatchObject({
    type: "VERIFY_PAYMENT",
    approve: true,
    note: "",
  })
```

### apps/web/e2e/request-workflow.spec.ts:1221:13

[apps/web/e2e/request-workflow.spec.ts:1221](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1221); SHA-256 `bbaa1793846f0b007a7987c415358571d96e361aa94e2fa4bb4afb4129eb11d3`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        page.getByRole("button", { name: "Activate project", exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1237:13

[apps/web/e2e/request-workflow.spec.ts:1237](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1237); SHA-256 `1280ad5946f8d1217e12f8c58f260b14383fb3d4f916d4b2d9b04c33af1560f2`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(page.getByRole("menuitem").last()).toContainText(
        "Project activation",
      )
```

### apps/web/e2e/request-workflow.spec.ts:1240:13

[apps/web/e2e/request-workflow.spec.ts:1240](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1240); SHA-256 `924b2a11e5015e9ff436e29d8b2aef8cce2d9dbc4678a9ad76e2a7bd1c215786`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(nextTool).toHaveText("Project activation")
```

### apps/web/e2e/request-workflow.spec.ts:1247:13

[apps/web/e2e/request-workflow.spec.ts:1247](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1247); SHA-256 `9a1fd6bcd457433ce7e2216a1fac41c00de0ee539113bed8147ffe00ff2672f7`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(setup).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1252:13

[apps/web/e2e/request-workflow.spec.ts:1252](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1252); SHA-256 `df47d26af195b61ea3393c9e9695a19d038cb7253ba42d0411a689ea6e654656`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(activate).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1253:13

[apps/web/e2e/request-workflow.spec.ts:1253](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1253); SHA-256 `c54526a2e203b07817ed28efc6489b6d4c2916a64a9b3af55c838feeb022c360`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        setup.getByRole("button", { name: "Approve staffing", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:1256:13

[apps/web/e2e/request-workflow.spec.ts:1256](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1256); SHA-256 `65d5bf4b80c8a8698ceb410c93fc2cdb2551a322676ac76f3f87500f2f79ec77`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        setup.getByRole("checkbox", { name: /Sam Worker/ }),
      ).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:1261:13

[apps/web/e2e/request-workflow.spec.ts:1261](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1261); SHA-256 `b43bd9841303fab83548e4978362c441c86535d811af4183d83fe98f22bd0ac9`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(setup).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1262:13

[apps/web/e2e/request-workflow.spec.ts:1262](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1262); SHA-256 `ca6fa0e1b3d188f63c400be61772a743b245112f557c07ca8bec8c6a9d2a05c2`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        page.getByRole("button", { name: "Open request actions", exact: true }),
      ).toBeFocused()
```

### apps/web/e2e/request-workflow.spec.ts:1265:7

[apps/web/e2e/request-workflow.spec.ts:1265](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1265); SHA-256 `c68bfb487368fe68ce90e28addf63577435ef06def6994a89c801c938d259b44`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(actions).toHaveLength(1)
```

### apps/web/e2e/request-workflow.spec.ts:1271:13

[apps/web/e2e/request-workflow.spec.ts:1271](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1271); SHA-256 `2d1085b7b2bff796bc6f5d0c0fb7afc26c6fcb9d553937afa7f04def9428a5b7`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        setup.getByRole("checkbox", { name: /Dani Worker/ }),
      ).not.toBeChecked()
```

### apps/web/e2e/request-workflow.spec.ts:1282:13

[apps/web/e2e/request-workflow.spec.ts:1282](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1282); SHA-256 `75e114cda155f5ae64c2c58ee11aa40fa0e46eb1793026a73f432c03236c92ff`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(setup.getByRole("alert")).toContainText(
        "Staffing temporarily unavailable",
      )
```

### apps/web/e2e/request-workflow.spec.ts:1285:13

[apps/web/e2e/request-workflow.spec.ts:1285](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1285); SHA-256 `43031732fc2264f898e32a19a134462555d3ed433b50781861a899ade1180ac7`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        setup.getByRole("checkbox", { name: /Dani Worker/ }),
      ).toBeChecked()
```

### apps/web/e2e/request-workflow.spec.ts:1288:13

[apps/web/e2e/request-workflow.spec.ts:1288](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1288); SHA-256 `df47d26af195b61ea3393c9e9695a19d038cb7253ba42d0411a689ea6e654656`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(activate).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1292:7

[apps/web/e2e/request-workflow.spec.ts:1292](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1292); SHA-256 `aed60678349c08e60aefc233d268b4b2ade39a4e947d1d822b9f2c4fd4399a24`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(staffingAttempts[0]!.actionId).toBe(staffingAttempts[1]!.actionId)
```

### apps/web/e2e/request-workflow.spec.ts:1293:13

[apps/web/e2e/request-workflow.spec.ts:1293](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1293); SHA-256 `603709aeede286b14b1d58b583890cb6cd3169cb076ec4dd318cdc0426ebf6a9`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(activate).toBeEnabled()
```

### apps/web/e2e/request-workflow.spec.ts:1294:7

[apps/web/e2e/request-workflow.spec.ts:1294](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1294); SHA-256 `019153f07ea9e952046f6f9fb21c2bfddc3b91bbeca89f8076c02bc69d677ce9`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(actions).toHaveLength(2)
```

### apps/web/e2e/request-workflow.spec.ts:1300:13

[apps/web/e2e/request-workflow.spec.ts:1300](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1300); SHA-256 `b43bd9841303fab83548e4978362c441c86535d811af4183d83fe98f22bd0ac9`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(setup).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1301:13

[apps/web/e2e/request-workflow.spec.ts:1301](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1301); SHA-256 `3b6990643d5188056f718d9f24faf8866af61706e9140119a96749df5b832f70`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        page.getByRole("button", {
          name: "Set up project workspace",
          exact: true,
        }),
      ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1307:13

[apps/web/e2e/request-workflow.spec.ts:1307](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1307); SHA-256 `05fab930bc76e7cfc9618245a4f6a20f231621452570b007dcbac804ae7d43ae`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect.poll(() => actions.length).toBe(3)
```

### apps/web/e2e/request-workflow.spec.ts:1308:7

[apps/web/e2e/request-workflow.spec.ts:1308](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1308); SHA-256 `8298eec26b2f47bde22589e0829644add3a86561a4bfe1b7494d7111cbe399f3`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(actions[0]).toMatchObject({
        type: "VERIFY_PAYMENT",
        approve: true,
      })
```

### apps/web/e2e/request-workflow.spec.ts:1312:7

[apps/web/e2e/request-workflow.spec.ts:1312](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1312); SHA-256 `64c47c228d17b0566e5700e215bfde139abe891591537d792dedf3aac03ea4a4`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(actions[1]).toMatchObject({
        type: "STAFF_PROJECT",
        employeeIds: ["employee-1"],
      })
```

### apps/web/e2e/request-workflow.spec.ts:1316:7

[apps/web/e2e/request-workflow.spec.ts:1316](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1316); SHA-256 `a2fdc30fafc653743a9c3ab4029671aa78c219cc3d8dfbab621943bc9448840f`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(actions[2]).toMatchObject({ type: "ACTIVATE_PROJECT" })
```

### apps/web/e2e/request-workflow.spec.ts:1317:13

[apps/web/e2e/request-workflow.spec.ts:1317](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1317); SHA-256 `61f0ae5f1d2f7e7f38cafaf3b07d63c5f05d610dcdc08eed7dfc79ee28194a45`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        page.getByRole("link", { name: "View Project", exact: true }),
      ).toHaveAttribute("href", "/project-workspace/project-1")
```

### apps/web/e2e/request-workflow.spec.ts:1320:13

[apps/web/e2e/request-workflow.spec.ts:1320](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1320); SHA-256 `da32396455d8c5c99f18f2c2f85eb5721df9147f7e7171bdd184b8835ed75218`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        page.getByRole("checkbox", { name: /Dani Worker/ }),
      ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1343:13

[apps/web/e2e/request-workflow.spec.ts:1343](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1343); SHA-256 `aa3db87c2f6e47c2a34c5437847cb13fd917f72e7d7e155a73b307363f937886`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(
        manage.getByRole("checkbox", { name: /Dani Worker/ }),
      ).toBeChecked()
```

### apps/web/e2e/request-workflow.spec.ts:1350:13

[apps/web/e2e/request-workflow.spec.ts:1350](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1350); SHA-256 `392548d51c6a737ea743083671efeb659102d067dec1c2907b4513a9d3937529`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(manage).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1351:13

[apps/web/e2e/request-workflow.spec.ts:1351](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1351); SHA-256 `c32315d7f477b679a42e88b8816d997e04b7189e74fc598fa299f2faa0cf6e60`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect.poll(() => actions.length).toBe(4)
```

### apps/web/e2e/request-workflow.spec.ts:1352:7

[apps/web/e2e/request-workflow.spec.ts:1352](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1352); SHA-256 `9eaa1a24f0ae70e43328f11e236f59effa105871c666ec87de98ae3fc514accf`.

Direct callback owners: PW-237, PW-238.

All possible owners, including helper/route/hook candidates: PW-237, PW-238.

```ts
expect(actions[3]).toMatchObject({
        type: "STAFF_PROJECT",
        employeeIds: ["employee-1", "employee-2"],
      })
```

### apps/web/e2e/request-workflow.spec.ts:1367:9

[apps/web/e2e/request-workflow.spec.ts:1367](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1367); SHA-256 `0a3e7762884199a4f78dede925ebd399d465a426727ab148c8dbbcf320f5a485`.

Direct callback owners: PW-239.

All possible owners, including helper/route/hook candidates: PW-239.

```ts
expect(
    page.getByRole("heading", { name: "Quotation · version 1" }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1370:9

[apps/web/e2e/request-workflow.spec.ts:1370](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1370); SHA-256 `7774623ef4fc84bfb7fa96c6b555647663115583b0b8f4f265b1a488708f06a6`.

Direct callback owners: PW-239.

All possible owners, including helper/route/hook candidates: PW-239.

```ts
expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1373:9

[apps/web/e2e/request-workflow.spec.ts:1373](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1373); SHA-256 `8936ebe501b8815ee888a48494ca422086d793622785b10c9be737065aed267a`.

Direct callback owners: PW-239.

All possible owners, including helper/route/hook candidates: PW-239.

```ts
expect(page.getByText(/Expired/)).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1408:9

[apps/web/e2e/request-workflow.spec.ts:1408](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1408); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/request-workflow.spec.ts:1409:9

[apps/web/e2e/request-workflow.spec.ts:1409](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1409); SHA-256 `8ab08b9749b7b11cbf90207f93fa7bbdef0405726c38cf91ab32a3084780c8e4`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(route.request().headers().authorization).toBe(
          "Bearer workflow-session",
        )
```

### apps/web/e2e/request-workflow.spec.ts:1442:11

[apps/web/e2e/request-workflow.spec.ts:1442](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1442); SHA-256 `7ee2be12de49f00290b76b95e9337afcd44029d92a96b97c886f25e8e03c8e02`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(page.getByLabel("Reason for rescheduling")).toHaveValue(
      "Client meeting conflict",
    )
```

### apps/web/e2e/request-workflow.spec.ts:1445:11

[apps/web/e2e/request-workflow.spec.ts:1445](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1445); SHA-256 `bf9c55cf27182577849edd27c95f9d9966f69f805220536ae973cbebacff2dc2`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect.poll(() => actions.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:1446:11

[apps/web/e2e/request-workflow.spec.ts:1446](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1446); SHA-256 `d32c8747be6512080337775e6047f7eee1abeda55175e029ca6bb157bfc3de91`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(reschedule).toBeEnabled()
```

### apps/web/e2e/request-workflow.spec.ts:1448:11

[apps/web/e2e/request-workflow.spec.ts:1448](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1448); SHA-256 `6b802c010edc8064f39cd80e61f09a4cbac6687982243a7d8faf75fca7deed73`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(
      page.getByText("Reschedule requested · Awaiting department response", {
        exact: true,
      }),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1453:5

[apps/web/e2e/request-workflow.spec.ts:1453](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1453); SHA-256 `019153f07ea9e952046f6f9fb21c2bfddc3b91bbeca89f8076c02bc69d677ce9`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(actions).toHaveLength(2)
```

### apps/web/e2e/request-workflow.spec.ts:1454:5

[apps/web/e2e/request-workflow.spec.ts:1454](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1454); SHA-256 `e4c5ded6af81475e731e0743048a5260b28c80df1c99321e3c94988150a19857`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(actions[1]).toEqual(actions[0])
```

### apps/web/e2e/request-workflow.spec.ts:1455:5

[apps/web/e2e/request-workflow.spec.ts:1455](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1455); SHA-256 `f12f1ff674fb7e6dab1c8fcf08c21fc22b8b0006f836641e3145e8724bc90e31`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(actions[0]).toMatchObject({
      type: "REQUEST_CONSULTATION_RESCHEDULE",
      consultationId: consultation.id,
      note: "Client meeting conflict",
      expectedVersion: 3,
    })
```

### apps/web/e2e/request-workflow.spec.ts:1461:5

[apps/web/e2e/request-workflow.spec.ts:1461](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1461); SHA-256 `7746123689c3cd14866468be5d365c0c25bd5c923bbc01ee703811e1b8f06d43`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(actions[0].actionId).toMatch(/^[0-9a-f-]{36}$/)
```

### apps/web/e2e/request-workflow.spec.ts:1462:5

[apps/web/e2e/request-workflow.spec.ts:1462](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1462); SHA-256 `3ed92f67db8881d1a0f779952dcc20e411c469079ad1837d89dd54ab30792eab`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(consultation.startsAt).toBe("2030-11-05T08:00:00.000Z")
```

### apps/web/e2e/request-workflow.spec.ts:1463:11

[apps/web/e2e/request-workflow.spec.ts:1463](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1463); SHA-256 `ab002e82b6d2f8967cb6ee65bdf6a468f765e2725833065cb0d7032c37183d6f`.

Direct callback owners: PW-240, PW-243.

All possible owners, including helper/route/hook candidates: PW-240, PW-243.

```ts
expect(reschedule).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1480:11

[apps/web/e2e/request-workflow.spec.ts:1480](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1480); SHA-256 `4d3156d68cb5003fbda6ce55beadea42f97c5f37f725793eb4ced0232a973b4e`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(pay).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1506:11

[apps/web/e2e/request-workflow.spec.ts:1506](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1506); SHA-256 `877ab2fea9e3adecffd019fe1f0bdb8fe7a625cdb691246ba107a634b79f0ace`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect.poll(() => attempts.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:1507:11

[apps/web/e2e/request-workflow.spec.ts:1507](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1507); SHA-256 `1b4068cb2f96597a3ff593c9acd4281d8aad0c37c4667d564a36c892b150e294`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(pay).toBeEnabled()
```

### apps/web/e2e/request-workflow.spec.ts:1508:11

[apps/web/e2e/request-workflow.spec.ts:1508](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1508); SHA-256 `f781dbab63f439ebf54d1eb1470ababf00a18ff15db8d5918a2922b28bc39dd6`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(page.getByLabel("Card number", { exact: true })).toHaveValue(
      "4000 0000 0000 0002",
    )
```

### apps/web/e2e/request-workflow.spec.ts:1512:11

[apps/web/e2e/request-workflow.spec.ts:1512](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1512); SHA-256 `8cc1da7c296ed6a469f52504e8774b5c4fc66be779369f0456319c289fe21d07`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(
      page.getByText(
        "Payment successful. Your sandbox card payment was automatically verified.",
        { exact: true },
      ),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1518:5

[apps/web/e2e/request-workflow.spec.ts:1518](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1518); SHA-256 `6afff62e8895b1ec20aac851244f148b283ffc7b830bf2a5dc9b6a04f77eb839`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(attempts).toHaveLength(2)
```

### apps/web/e2e/request-workflow.spec.ts:1519:5

[apps/web/e2e/request-workflow.spec.ts:1519](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1519); SHA-256 `ab963043e382c4c72c18f92af1cf2d082c6dbf8d74b3ca1ca4770fbd4c3897a8`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(attempts[1]).toEqual(attempts[0])
```

### apps/web/e2e/request-workflow.spec.ts:1520:5

[apps/web/e2e/request-workflow.spec.ts:1520](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1520); SHA-256 `e50012e1aa3255f70ec1ca42946bf6916b8618d15b72cfc2dc3311a49fea1247`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(attempts[0]).toEqual({
      type: "COMPLETE_SANDBOX_PAYMENT",
      actionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      expectedVersion: 4,
    })
```

### apps/web/e2e/request-workflow.spec.ts:1525:11

[apps/web/e2e/request-workflow.spec.ts:1525](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1525); SHA-256 `85dcb9eeda58e255b9195e452f4eb24c99fc0f8cd9af8a2684b1ff9af06c7d1d`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(pay).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1526:11

[apps/web/e2e/request-workflow.spec.ts:1526](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1526); SHA-256 `5401e940745859c5f5a466de1a83591bf6a2ca6f8ed53040ee9839c983f9a44e`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(page.getByText(/awaiting verification/i)).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1527:11

[apps/web/e2e/request-workflow.spec.ts:1527](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1527); SHA-256 `233ed2bb8422f26d4d8eee26f7747491292f1870f129ebcb32d037fcd0a5f1c4`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(page.getByText(/activation will wait until/i)).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1528:5

[apps/web/e2e/request-workflow.spec.ts:1528](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1528); SHA-256 `2a0a11fd091e00cafbc1b022abdd90ac053b983b4a086cd7d5c7c3f155800c06`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(workflow.state).toBe("READY_FOR_ACTIVATION")
```

### apps/web/e2e/request-workflow.spec.ts:1529:11

[apps/web/e2e/request-workflow.spec.ts:1529](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1529); SHA-256 `439dbbe7d3a55f1157083ccc50e05dc1236e0a182658281562e96acc5e954891`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(
      page.getByRole("button", {
        name: "Set up project workspace",
        exact: true,
      }),
    ).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1536:11

[apps/web/e2e/request-workflow.spec.ts:1536](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1536); SHA-256 `8cc1da7c296ed6a469f52504e8774b5c4fc66be779369f0456319c289fe21d07`.

Direct callback owners: PW-241, PW-244.

All possible owners, including helper/route/hook candidates: PW-241, PW-244.

```ts
expect(
      page.getByText(
        "Payment successful. Your sandbox card payment was automatically verified.",
        { exact: true },
      ),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1578:7

[apps/web/e2e/request-workflow.spec.ts:1578](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1578); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/request-workflow.spec.ts:1579:7

[apps/web/e2e/request-workflow.spec.ts:1579](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1579); SHA-256 `fc8ea8e01b5a23bcd15226d2996b32e327bbe8b39169eba15ece0541647c6acd`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(route.request().headers().authorization).toBe(
        "Bearer workflow-session",
      )
```

### apps/web/e2e/request-workflow.spec.ts:1600:7

[apps/web/e2e/request-workflow.spec.ts:1600](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1600); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/request-workflow.spec.ts:1619:11

[apps/web/e2e/request-workflow.spec.ts:1619](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1619); SHA-256 `1635f52ded7b901b9b287862f2a80b6b7a6137bfe1ab7ca2dc6914d630476e9b`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(submit).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:1631:11

[apps/web/e2e/request-workflow.spec.ts:1631](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1631); SHA-256 `ac8bc3533c2ad2a90a527f07835e267b2edd227598c85f81c934a2fe753a38f9`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(preview).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1635:11

[apps/web/e2e/request-workflow.spec.ts:1635](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1635); SHA-256 `957c5a1f6b41fdfaa67851632773b8e946540ce034d35334831a549868b59aee`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(preview).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1636:11

[apps/web/e2e/request-workflow.spec.ts:1636](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1636); SHA-256 `1635f52ded7b901b9b287862f2a80b6b7a6137bfe1ab7ca2dc6914d630476e9b`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(submit).toBeDisabled()
```

### apps/web/e2e/request-workflow.spec.ts:1637:5

[apps/web/e2e/request-workflow.spec.ts:1637](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1637); SHA-256 `95d0cbd36fa3930d2bcf8321740940971dd48f34eef3c70201df369139eb0e09`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(uploads).toEqual([])
```

### apps/web/e2e/request-workflow.spec.ts:1644:11

[apps/web/e2e/request-workflow.spec.ts:1644](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1644); SHA-256 `7260b96bb7208b598859d5143e173d750dbf1160df6777f964fa5c843cf794ab`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect.poll(() => uploads.length).toBe(1)
```

### apps/web/e2e/request-workflow.spec.ts:1645:11

[apps/web/e2e/request-workflow.spec.ts:1645](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1645); SHA-256 `9c144b505151a81913b3e2bb0a784f956979490c96247b4649d66d8dc34d063f`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(submit).toBeEnabled()
```

### apps/web/e2e/request-workflow.spec.ts:1646:11

[apps/web/e2e/request-workflow.spec.ts:1646](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1646); SHA-256 `ac8bc3533c2ad2a90a527f07835e267b2edd227598c85f81c934a2fe753a38f9`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(preview).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1647:5

[apps/web/e2e/request-workflow.spec.ts:1647](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1647); SHA-256 `b959116805b924953ea15daf34d263195b7269514ede34a6b6937e415fda2978`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(actions).toEqual([])
```

### apps/web/e2e/request-workflow.spec.ts:1649:11

[apps/web/e2e/request-workflow.spec.ts:1649](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1649); SHA-256 `4e9336fe23c50e0c3e964dcda5d940a9d781bc55e2517f46a215a3bfe3a9d1db`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(
      page.getByText(
        /Your payment proof has been submitted and is awaiting verification/,
      ),
    ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1654:5

[apps/web/e2e/request-workflow.spec.ts:1654](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1654); SHA-256 `7e3bbc44aae4ca39e59c3eabb5e4563b480d852d01787d492c7812b49276c281`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(uploads).toHaveLength(2)
```

### apps/web/e2e/request-workflow.spec.ts:1655:5

[apps/web/e2e/request-workflow.spec.ts:1655](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1655); SHA-256 `386229fc8be7c3e41ee67c5953f7a6f5fe6f7580d1d75fef46213e547dd3880c`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(uploads[1]).toEqual(uploads[0])
```

### apps/web/e2e/request-workflow.spec.ts:1656:5

[apps/web/e2e/request-workflow.spec.ts:1656](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1656); SHA-256 `e8eceea147bcb7fe2840e79189deb81b4f6c9ba95a1349f9a96f667cda781190`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(uploads[0]).toMatchObject({
      name: "receipt.png",
      contextual: true,
      mimeType: "image/png",
      content: buffer.toString("base64"),
    })
```

### apps/web/e2e/request-workflow.spec.ts:1662:5

[apps/web/e2e/request-workflow.spec.ts:1662](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1662); SHA-256 `c68bfb487368fe68ce90e28addf63577435ef06def6994a89c801c938d259b44`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(actions).toHaveLength(1)
```

### apps/web/e2e/request-workflow.spec.ts:1663:5

[apps/web/e2e/request-workflow.spec.ts:1663](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1663); SHA-256 `5d4152c9c1f2d7502d10fa078a10050eb39e9c2f7f89e87471b3df921d704ebd`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(actions[0]).toMatchObject({
      type: "SUBMIT_PAYMENT",
      fileId: "proof-1",
      reference: "BANK-123",
      expectedVersion: 3,
    })
```

### apps/web/e2e/request-workflow.spec.ts:1669:11

[apps/web/e2e/request-workflow.spec.ts:1669](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1669); SHA-256 `d04308c609fc9fd989ce603f4e4e2a200040ac1fe77d71423283f9bc29466812`.

Direct callback owners: PW-242, PW-245.

All possible owners, including helper/route/hook candidates: PW-242, PW-245.

```ts
expect(submit).toHaveCount(0)
```

### apps/web/e2e/request-workflow.spec.ts:1696:9

[apps/web/e2e/request-workflow.spec.ts:1696](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1696); SHA-256 `25cdade5f0b875e8acd24c16805cc30ab1258255d055b2add020e9699f71b4f6`.

Direct callback owners: PW-246.

All possible owners, including helper/route/hook candidates: PW-246.

```ts
expect(context.locator("details.group\\/context")).not.toHaveAttribute(
    "open",
  )
```

### apps/web/e2e/request-workflow.spec.ts:1702:9

[apps/web/e2e/request-workflow.spec.ts:1702](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1702); SHA-256 `73a2ba7277314472455a6bcc868fb1b874f454a149e325f38da12433d13adfd8`.

Direct callback owners: PW-246.

All possible owners, including helper/route/hook candidates: PW-246.

```ts
expect(
    context.getByRole("definition").filter({ hasText: "REQ-2026-1001" }),
  ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1708:9

[apps/web/e2e/request-workflow.spec.ts:1708](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1708); SHA-256 `58e89198878f2e359b13296f0b84e558e4c79b3393e872ff9328e76a7b37110f`.

Direct callback owners: PW-246.

All possible owners, including helper/route/hook candidates: PW-246.

```ts
expect(
    page.getByRole("link", { name: "View Project", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1")
```

### apps/web/e2e/request-workflow.spec.ts:1711:3

[apps/web/e2e/request-workflow.spec.ts:1711](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1711); SHA-256 `d8aa5941b039f3949ee56645492f6f8ebdc19450bc9f4556b68711e49608aaaf`.

Direct callback owners: PW-246.

All possible owners, including helper/route/hook candidates: PW-246.

```ts
expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
```

### apps/web/e2e/request-workflow.spec.ts:1753:13

[apps/web/e2e/request-workflow.spec.ts:1753](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1753); SHA-256 `58639b3823c6473aaf49d043c9ba80ffb357b99a39b72d997a35e5c81a952789`.

Direct callback owners: PW-247, PW-248.

All possible owners, including helper/route/hook candidates: PW-247, PW-248.

```ts
expect(note).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1754:13

[apps/web/e2e/request-workflow.spec.ts:1754](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1754); SHA-256 `949f32fbcd58ec597eac65c01e3f421717593a666a073011817c91339f6cda8b`.

Direct callback owners: PW-247, PW-248.

All possible owners, including helper/route/hook candidates: PW-247, PW-248.

```ts
expect(note.getByLabel("Note for your team")).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1763:13

[apps/web/e2e/request-workflow.spec.ts:1763](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1763); SHA-256 `e5b1356bb0f5cf2b4d5fdc5c2b0985fa2b6459642e2568bc60814f25e184d0ac`.

Direct callback owners: PW-247, PW-248.

All possible owners, including helper/route/hook candidates: PW-247, PW-248.

```ts
expect(assignments).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1764:13

[apps/web/e2e/request-workflow.spec.ts:1764](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1764); SHA-256 `d76bd16424be0385f72932c1ba68c16d6f254b2ca89744af0de410f642821902`.

Direct callback owners: PW-247, PW-248.

All possible owners, including helper/route/hook candidates: PW-247, PW-248.

```ts
expect(
        assignments.getByRole("combobox", { name: /^Quotation approver/ }),
      ).toBeVisible()
```

### apps/web/e2e/request-workflow.spec.ts:1767:13

[apps/web/e2e/request-workflow.spec.ts:1767](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:1767); SHA-256 `b0324b98549764a8ffe76ad5d4e54179ecc4ed500d17a508dc57ddaf21fbd059`.

Direct callback owners: PW-247, PW-248.

All possible owners, including helper/route/hook candidates: PW-247, PW-248.

```ts
expect(
        assignments.getByRole("combobox", { name: /^Payment verifier/ }),
      ).toBeVisible()
```

## apps/web/e2e/responsive-data-table.spec.ts

### apps/web/e2e/responsive-data-table.spec.ts:121:11

[apps/web/e2e/responsive-data-table.spec.ts:121](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:121); SHA-256 `68258d60b3ce785878377685423aceaea7e7c1372ef65ed8bdcf80d036cd7023`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table).toHaveAttribute("aria-busy", "true")
```

### apps/web/e2e/responsive-data-table.spec.ts:122:11

[apps/web/e2e/responsive-data-table.spec.ts:122](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:122); SHA-256 `3302d2db0c51d99b58ca99c583cfb324e14512a22016da6cb3786ab41b984a1e`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByRole("status")).toHaveText("Loading clients…")
```

### apps/web/e2e/responsive-data-table.spec.ts:125:11

[apps/web/e2e/responsive-data-table.spec.ts:125](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:125); SHA-256 `b60e2fad95d9c7de17d54ce253a64a3c05f0ad5e568122d730098b971ded3c0c`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table).toHaveAttribute("aria-busy", "false")
```

### apps/web/e2e/responsive-data-table.spec.ts:126:11

[apps/web/e2e/responsive-data-table.spec.ts:126](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:126); SHA-256 `a1a149ec19a893ec1fb17a6c0ec00f99e5bab6760d88dc8632e89cbc66893c05`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByText("Zeta Client", { exact: true })).toBeVisible()
```

### apps/web/e2e/responsive-data-table.spec.ts:127:11

[apps/web/e2e/responsive-data-table.spec.ts:127](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:127); SHA-256 `520ea44846a0386c9418148680d45230d8f819c62e6d5ab2d342e245e22d9e3b`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(
      table.getByRole("columnheader", { name: /Date registered/i }),
    ).toHaveAttribute("aria-sort", "descending")
```

### apps/web/e2e/responsive-data-table.spec.ts:132:11

[apps/web/e2e/responsive-data-table.spec.ts:132](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:132); SHA-256 `9f56984b77069f7d17c80a65e8fe8072e9bcce97cebd263bd72f83b779258860`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(
      table.getByRole("columnheader", { name: /Client name/i }),
    ).toHaveAttribute("aria-sort", "ascending")
```

### apps/web/e2e/responsive-data-table.spec.ts:135:11

[apps/web/e2e/responsive-data-table.spec.ts:135](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:135); SHA-256 `b677010c4d5b10c69c326d8b9ff86d95377cff9cc00ef892ff2b14bb8f103339`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByRole("row").nth(1)).toContainText("Alpha Client")
```

### apps/web/e2e/responsive-data-table.spec.ts:139:11

[apps/web/e2e/responsive-data-table.spec.ts:139](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:139); SHA-256 `5be90b376083807a92414e3e07e20c61082d21088ee2d6083cfec361130a7e39`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByText("Alpha Client", { exact: true })).toBeVisible()
```

### apps/web/e2e/responsive-data-table.spec.ts:140:11

[apps/web/e2e/responsive-data-table.spec.ts:140](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:140); SHA-256 `c2b4d180cbcc612558ab8731d4e63f5b8e0cba063435dbb4724c5b5f567288fd`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByText("Zeta Client", { exact: true })).toHaveCount(0)
```

### apps/web/e2e/responsive-data-table.spec.ts:142:11

[apps/web/e2e/responsive-data-table.spec.ts:142](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:142); SHA-256 `5cd909c7b00cc28210074a06bd5b31d8ab3bd2299bfc2d708dbeeaab088fb9ba`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(
      table.getByRole("status").filter({ hasText: "missing client" }),
    ).toBeVisible()
```

### apps/web/e2e/responsive-data-table.spec.ts:151:11

[apps/web/e2e/responsive-data-table.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:151); SHA-256 `6656aad8fc5072cb8bc823935cc53da15eb75db51280bcd33115432598cf0179`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByRole("alert")).toHaveText(
      /Client directory temporarily unavailable/,
    )
```

### apps/web/e2e/responsive-data-table.spec.ts:155:11

[apps/web/e2e/responsive-data-table.spec.ts:155](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:155); SHA-256 `5be90b376083807a92414e3e07e20c61082d21088ee2d6083cfec361130a7e39`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(table.getByText("Alpha Client", { exact: true })).toBeVisible()
```

### apps/web/e2e/responsive-data-table.spec.ts:163:11

[apps/web/e2e/responsive-data-table.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:163); SHA-256 `0d480a310e1e5010db0cdc4a0cb5a5d31b564c67415d2bcb394009a177802ec2`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(dialog).toContainText("Alpha Client")
```

### apps/web/e2e/responsive-data-table.spec.ts:167:11

[apps/web/e2e/responsive-data-table.spec.ts:167](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:167); SHA-256 `22735e72077672431635da569730b12df58ba0140c04950493274c2e6fb4efc2`.

Direct callback owners: PW-249.

All possible owners, including helper/route/hook candidates: PW-249.

```ts
expect(view).toBeFocused()
```

### apps/web/e2e/responsive-data-table.spec.ts:178:11

[apps/web/e2e/responsive-data-table.spec.ts:178](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:178); SHA-256 `5be90b376083807a92414e3e07e20c61082d21088ee2d6083cfec361130a7e39`.

Direct callback owners: PW-250.

All possible owners, including helper/route/hook candidates: PW-250.

```ts
expect(table.getByText("Alpha Client", { exact: true })).toBeVisible()
```

### apps/web/e2e/responsive-data-table.spec.ts:179:11

[apps/web/e2e/responsive-data-table.spec.ts:179](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:179); SHA-256 `22413b67803b2ec1e85ceb546d1cddb3183417e53d25a8ea07a8fde45874b10f`.

Direct callback owners: PW-250.

All possible owners, including helper/route/hook candidates: PW-250.

```ts
expect(
      table.getByRole("button", { name: "View Alpha Client" }),
    ).toBeVisible()
```

### apps/web/e2e/responsive-data-table.spec.ts:182:5

[apps/web/e2e/responsive-data-table.spec.ts:182](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:182); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-250.

All possible owners, including helper/route/hook candidates: PW-250.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/responsive-data-table.spec.ts:193:5

[apps/web/e2e/responsive-data-table.spec.ts:193](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:193); SHA-256 `39c055347a6ebbe1b694167e40806caeb31b64f3f2b162031076f9b4783fc3d4`.

Direct callback owners: PW-250.

All possible owners, including helper/route/hook candidates: PW-250.

```ts
expect(actionSize.width).toBeGreaterThanOrEqual(32)
```

### apps/web/e2e/responsive-data-table.spec.ts:194:5

[apps/web/e2e/responsive-data-table.spec.ts:194](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:194); SHA-256 `fc0602ec5102ebd45705017ea5e5905950fbceaaa2a04fa7b3a6f01f8fe27186`.

Direct callback owners: PW-250.

All possible owners, including helper/route/hook candidates: PW-250.

```ts
expect(actionSize.height).toBeGreaterThanOrEqual(32)
```

## apps/web/e2e/services.spec.ts

### apps/web/e2e/services.spec.ts:24:11

[apps/web/e2e/services.spec.ts:24](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:24); SHA-256 `d92dee4f5af84bc42610c2b487b109cfae9ce367d872cf91c22e951096dcf64c`.

Direct callback owners: PW-251.

All possible owners, including helper/route/hook candidates: PW-251.

```ts
expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:32:13

[apps/web/e2e/services.spec.ts:32](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:32); SHA-256 `03f60f7f4b0f730be359e62f8e09e0dadaea104ace4e4fbd4a2905b0ae8b88ed`.

Direct callback owners: PW-251.

All possible owners, including helper/route/hook candidates: PW-251.

```ts
expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      )
```

### apps/web/e2e/services.spec.ts:38:11

[apps/web/e2e/services.spec.ts:38](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:38); SHA-256 `909088c9f8000bc2a270e2c9b029f75e5ba9fa0d309a945d71941da26d335de2`.

Direct callback owners: PW-251.

All possible owners, including helper/route/hook candidates: PW-251.

```ts
expect(detailsPanel).toContainText(
      "A service used by the regression suite.",
    )
```

### apps/web/e2e/services.spec.ts:42:5

[apps/web/e2e/services.spec.ts:42](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:42); SHA-256 `d0620fc9b4c77b682a62fe43f13d92f5e6491817b51273a165e17eb6b61f89a1`.

Direct callback owners: PW-251.

All possible owners, including helper/route/hook candidates: PW-251.

```ts
expect(panelBounds).not.toBeNull()
```

### apps/web/e2e/services.spec.ts:43:5

[apps/web/e2e/services.spec.ts:43](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:43); SHA-256 `14a365d15f1bcc3cbad7a1692b533e1153d3b413e759a5dea39c55475ce08374`.

Direct callback owners: PW-251.

All possible owners, including helper/route/hook candidates: PW-251.

```ts
expect(panelBounds?.x).toBeGreaterThan(600)
```

### apps/web/e2e/services.spec.ts:44:5

[apps/web/e2e/services.spec.ts:44](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:44); SHA-256 `7291969c055efef70a568f37925bb4a3e552991972ae1492490925dd00b77b43`.

Direct callback owners: PW-251.

All possible owners, including helper/route/hook candidates: PW-251.

```ts
expect(panelBounds?.width).toBeLessThan(620)
```

### apps/web/e2e/services.spec.ts:69:11

[apps/web/e2e/services.spec.ts:69](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:69); SHA-256 `9f3931e1603d11c5d0f0f10db3c79133ab672aacf31fea1516dec1dd8512e8c3`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog.getByLabel("Benefit Title")).toHaveValue(
      "Launch with confidence",
    )
```

### apps/web/e2e/services.spec.ts:92:11

[apps/web/e2e/services.spec.ts:92](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:92); SHA-256 `fd1e8cbe4d520cd49aeb6c3bfbf729f2e4a74855ca24cb6dece05aff49dff68b`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog.getByRole("alert")).toHaveText(
      "Select a billing interval",
    )
```

### apps/web/e2e/services.spec.ts:103:5

[apps/web/e2e/services.spec.ts:103](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:103); SHA-256 `0567957ec0b97564959b1cf80d476e6d6080a39fe875292ab6921f87588dc38e`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect((await saved).postDataJSON()).toMatchObject({
      clientRequirements: ["Brand guide", "Project brief"],
      requiresConsultation: true,
      consultationNotes: "Discuss project scope",
      keyBenefits: [
        {
          title: "Launch with confidence",
          description: "A guided process from discovery through delivery.",
        },
      ],
      pricingTemplateId: null,
      pricingTemplate: {
        name: "Monthly support",
        pricingModel: "RECURRING",
        amount: 1500.5,
        currency: "PHP",
        billingInterval: "MONTHLY",
        isPublic: true,
      },
      packages: [],
    })
```

### apps/web/e2e/services.spec.ts:124:11

[apps/web/e2e/services.spec.ts:124](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:124); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:133:13

[apps/web/e2e/services.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:133); SHA-256 `85f1f133c4775513b91ffe1eebff53752629de1873f40f0a2dd3aa5faa48d305`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog).toContainText(text)
```

### apps/web/e2e/services.spec.ts:140:11

[apps/web/e2e/services.spec.ts:140](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:140); SHA-256 `9f3931e1603d11c5d0f0f10db3c79133ab672aacf31fea1516dec1dd8512e8c3`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog.getByLabel("Benefit Title")).toHaveValue(
      "Launch with confidence",
    )
```

### apps/web/e2e/services.spec.ts:144:11

[apps/web/e2e/services.spec.ts:144](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:144); SHA-256 `4eeb3ebc43d6f02405ab7727e86287bbb4327005b3dd409e9535c3d79ed469f8`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog.getByLabel("Consultation Notes")).toHaveValue(
      "Discuss project scope",
    )
```

### apps/web/e2e/services.spec.ts:151:11

[apps/web/e2e/services.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:151); SHA-256 `4d7025a5d90916319c2c35e8c5d083beb1a2cafc6dbc9191433fb13672beecdc`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toContainText("Monthly support")
```

### apps/web/e2e/services.spec.ts:155:11

[apps/web/e2e/services.spec.ts:155](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:155); SHA-256 `c83518fc5f405514e77ec56f043e460ab3ca2edd85cd802a8fefda0c2c36a946`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog.getByRole("radio", { name: /^Pricing/ })).toBeChecked()
```

### apps/web/e2e/services.spec.ts:156:11

[apps/web/e2e/services.spec.ts:156](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:156); SHA-256 `361842ecb85694c3f3ed2360315e74a01351810adcaccd713ecc1efc09281cbb`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(
      dialog.getByRole("radio", { name: /^Packages/ }),
    ).not.toBeChecked()
```

### apps/web/e2e/services.spec.ts:159:11

[apps/web/e2e/services.spec.ts:159](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:159); SHA-256 `92874ba7b7ea1d46b48eeb03bc2a91552ed3a82fb00f6db7a0abe0f4d25731af`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(
      dialog.getByRole("button", { name: "Save Changes" }),
    ).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:163:11

[apps/web/e2e/services.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:163); SHA-256 `2209a316a9b2c1b8cc7b6bae74ff85bc7b134730c0519cc64974935fae68603d`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:172:5

[apps/web/e2e/services.spec.ts:172](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:172); SHA-256 `9c53b202e1516754fe667a6ca6b3caa4f918010abc8965ddcde87e006b168807`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect((await updated).postDataJSON()).toMatchObject({
      requiresConsultation: false,
      consultationNotes: null,
      pricingTemplateId: "pricing-1",
      pricingTemplate: null,
      packages: [],
    })
```

### apps/web/e2e/services.spec.ts:179:11

[apps/web/e2e/services.spec.ts:179](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:179); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-252.

All possible owners, including helper/route/hook candidates: PW-252.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:204:11

[apps/web/e2e/services.spec.ts:204](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:204); SHA-256 `92874ba7b7ea1d46b48eeb03bc2a91552ed3a82fb00f6db7a0abe0f4d25731af`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(
      dialog.getByRole("button", { name: "Save Changes" }),
    ).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:208:11

[apps/web/e2e/services.spec.ts:208](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:208); SHA-256 `a1369983001ec7819c9a484356961770db2011867431f6d16b3b9971db411b25`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByLabel("Package Name")).toHaveCount(2)
```

### apps/web/e2e/services.spec.ts:209:11

[apps/web/e2e/services.spec.ts:209](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:209); SHA-256 `b8d01786d108e58a55e2e8382ecc469d87e470a941ecfc7bc6e5344a24084484`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:229:11

[apps/web/e2e/services.spec.ts:229](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:229); SHA-256 `e92bad8d8549e446444554a6af3dc90a9853b358a51a0e3e955cbd2510a3c27c`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByRole("alert")).toHaveText(
      "Add at least two packages, or choose Pricing for a single option",
    )
```

### apps/web/e2e/services.spec.ts:245:5

[apps/web/e2e/services.spec.ts:245](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:245); SHA-256 `4d8824fc8bf4a5b45f54c6b40833ee296905ef32b708ce292c122d1a38a750e3`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect((await saved).postDataJSON()).toMatchObject({
      pricingTemplateId: null,
      pricingTemplate: null,
      packages: [
        expect.objectContaining({
          name: "Starter",
          includedFeatures: ["Email support", "Monthly review"],
          isRecommended: true,
        }),
        expect.objectContaining({ name: "Premium" }),
      ],
    })
```

### apps/web/e2e/services.spec.ts:257:11

[apps/web/e2e/services.spec.ts:257](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:257); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:263:11

[apps/web/e2e/services.spec.ts:263](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:263); SHA-256 `3e9bad3966c9a6acb86ec57f6ca115c4047ae187a6dda69f345417ff3fc59a02`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByRole("radio", { name: /^Packages/ })).toBeChecked()
```

### apps/web/e2e/services.spec.ts:265:11

[apps/web/e2e/services.spec.ts:265](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:265); SHA-256 `3ddff0777a0720e51ffb70cf1ba77d31da8e84a3fb260a7407183fdb7e6ba58c`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByLabel("Package Name").first()).toHaveValue(
      "Starter",
    )
```

### apps/web/e2e/services.spec.ts:268:11

[apps/web/e2e/services.spec.ts:268](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:268); SHA-256 `c38b8e3ded6ef7a2bbcfda770598598ff1af1a11c35d8834de0980df6787d6d3`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByLabel("Package Name").last()).toHaveValue(
      "Premium",
    )
```

### apps/web/e2e/services.spec.ts:276:11

[apps/web/e2e/services.spec.ts:276](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:276); SHA-256 `ba658fed9b0c5be4b816e7becd58a471e6fda954ed1fe2fd45b57ea42b5f5d29`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByLabel("Package Name")).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:283:5

[apps/web/e2e/services.spec.ts:283](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:283); SHA-256 `895f214494e236cba14cf4b444ece4d52e445dc9fa84f237e518570e427faea4`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect((await updated).postDataJSON()).toMatchObject({ packages: [] })
```

### apps/web/e2e/services.spec.ts:284:11

[apps/web/e2e/services.spec.ts:284](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:284); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:290:11

[apps/web/e2e/services.spec.ts:290](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:290); SHA-256 `c83518fc5f405514e77ec56f043e460ab3ca2edd85cd802a8fefda0c2c36a946`.

Direct callback owners: PW-253.

All possible owners, including helper/route/hook candidates: PW-253.

```ts
expect(dialog.getByRole("radio", { name: /^Pricing/ })).toBeChecked()
```

### apps/web/e2e/services.spec.ts:302:11

[apps/web/e2e/services.spec.ts:302](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:302); SHA-256 `72371c462b387f98b13642967b153c75fee6f564e2e6f0fe88df60d466dc2ed5`.

Direct callback owners: PW-254.

All possible owners, including helper/route/hook candidates: PW-254.

```ts
expect(
      page.getByRole("menuitem", { name: "Delete service" }),
    ).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:309:11

[apps/web/e2e/services.spec.ts:309](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:309); SHA-256 `ee772a6084ddc5f2ea59c16d52f1a7b4cbae2821a5d9afe2d6cd466c3b026faf`.

Direct callback owners: PW-254.

All possible owners, including helper/route/hook candidates: PW-254.

```ts
expect(
      page.getByRole("row").filter({ hasText: "Test Service" }),
    ).toContainText("Inactive")
```

### apps/web/e2e/services.spec.ts:315:11

[apps/web/e2e/services.spec.ts:315](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:315); SHA-256 `d92dee4f5af84bc42610c2b487b109cfae9ce367d872cf91c22e951096dcf64c`.

Direct callback owners: PW-254.

All possible owners, including helper/route/hook candidates: PW-254.

```ts
expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:323:11

[apps/web/e2e/services.spec.ts:323](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:323); SHA-256 `40889b132a817ad5625105071296d1f10c9dacba162305e5a307395ad3bb174e`.

Direct callback owners: PW-254.

All possible owners, including helper/route/hook candidates: PW-254.

```ts
expect(
      page.getByText("No services have been created yet."),
    ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:356:11

[apps/web/e2e/services.spec.ts:356](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:356); SHA-256 `38390ccefe7df2372135e83a32c580d7c8caf4bb885f7d1f24492cb41c1697f8`.

Direct callback owners: PW-255.

All possible owners, including helper/route/hook candidates: PW-255.

```ts
expect(page.getByText(payload, { exact: true })).toBeVisible()
```

### apps/web/e2e/services.spec.ts:358:11

[apps/web/e2e/services.spec.ts:358](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:358); SHA-256 `2901b494afd5c40b3c702c2362e3e5e080378b292bd6a2b2e132d44570285965`.

Direct callback owners: PW-255.

All possible owners, including helper/route/hook candidates: PW-255.

```ts
expect(page.getByRole("dialog")).toContainText(payload)
```

### apps/web/e2e/services.spec.ts:359:5

[apps/web/e2e/services.spec.ts:359](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:359); SHA-256 `54d4167595a424d40d953d352f4e0c979e3db140feb3fe0923c9fb4d9af36c82`.

Direct callback owners: PW-255.

All possible owners, including helper/route/hook candidates: PW-255.

```ts
expect(
      await page.evaluate(() => Reflect.get(window, "__regressionXss")),
    ).toBeUndefined()
```

### apps/web/e2e/services.spec.ts:362:11

[apps/web/e2e/services.spec.ts:362](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:362); SHA-256 `06a258113c374e6f3f610e3425018ce1814be47050bf8ec118f1082aa2cfb5da`.

Direct callback owners: PW-255.

All possible owners, including helper/route/hook candidates: PW-255.

```ts
expect(page.locator('img[src="x"]')).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:380:13

[apps/web/e2e/services.spec.ts:380](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:380); SHA-256 `0cce1c40dd997f534df0a1caffa7fa22e4c72140e30f6e8ac6b857e2f16d3553`.

Direct callback owners: PW-256, PW-257.

All possible owners, including helper/route/hook candidates: PW-256, PW-257.

```ts
expect(
        page.getByRole("table", { name: "Services" }).getByRole("alert"),
      ).toContainText("Service list unavailable")
```

### apps/web/e2e/services.spec.ts:383:7

[apps/web/e2e/services.spec.ts:383](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:383); SHA-256 `47b1776559c458699f70191fd502a651136821430ede0ed39a1c504022dffaac`.

Direct callback owners: PW-256, PW-257.

All possible owners, including helper/route/hook candidates: PW-256, PW-257.

```ts
expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
```

### apps/web/e2e/services.spec.ts:384:13

[apps/web/e2e/services.spec.ts:384](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:384); SHA-256 `f400bb03aca328f9d74709d0a98e298b739087217419c9151e52380dcc9c976e`.

Direct callback owners: PW-256, PW-257.

All possible owners, including helper/route/hook candidates: PW-256, PW-257.

```ts
expect(
        page.getByRole("rowheader", { name: "Test Service" }),
      ).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:388:13

[apps/web/e2e/services.spec.ts:388](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:388); SHA-256 `3147d2583402bf6f68edc93952784622d85129c7644c1402f767dc8ebbab9afd`.

Direct callback owners: PW-256, PW-257.

All possible owners, including helper/route/hook candidates: PW-256, PW-257.

```ts
expect(
        page.getByRole("rowheader", { name: "Test Service" }),
      ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:411:13

[apps/web/e2e/services.spec.ts:411](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:411); SHA-256 `50197935ad60afe679be1f9abd68ab313f35ace8aa79571b5a24a1ffbee9a9ad`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByRole("alert")).toHaveText(
        "Please select at least one responsible department",
      )
```

### apps/web/e2e/services.spec.ts:424:13

[apps/web/e2e/services.spec.ts:424](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:424); SHA-256 `8bcbb6c6bad07b517e1cf6124da5783cf6f2f15ef4f3c67cfe00177549635cfa`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(
        dialog.getByRole("radio", { name: /^Pricing/ }),
      ).not.toBeChecked()
```

### apps/web/e2e/services.spec.ts:430:13

[apps/web/e2e/services.spec.ts:430](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:430); SHA-256 `ffbbbf0a928d00252aeddc9bf3b07391cc94733f3648b524682aedfaf533407d`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByRole("alert")).toHaveText(
        "Choose Pricing or Packages to continue",
      )
```

### apps/web/e2e/services.spec.ts:460:7

[apps/web/e2e/services.spec.ts:460](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:460); SHA-256 `5bcad3bfff1318ff3a716862cf19b9334d7fcfda34f207afdf2ba3fc1263d984`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect((await created).postDataJSON()).toEqual({
        name: "Consulting",
        description: "Business consulting",
        iconKey: "sparkles",
        departmentIds: ["dept-1"],
        isActive: true,
        imageDataUrl: null,
        imageAltText: null,
        removeImage: false,
        clientRequirements: [],
        requiresConsultation: false,
        requiresAgreement: true,
        requiresPayment: true,
        requiresQuotationApproval: false,
        consultationNotes: null,
        keyBenefits: [],
        pricingTemplateId: null,
        pricingTemplate: null,
        packages:
          offering === "Packages"
            ? [
                expect.objectContaining({
                  name: "Starter",
                  includedFeatures: ["Business analysis"],
                }),
                expect.objectContaining({
                  name: "Premium",
                  includedFeatures: ["Business analysis"],
                }),
              ]
            : [],
      })
```

### apps/web/e2e/services.spec.ts:492:13

[apps/web/e2e/services.spec.ts:492](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:492); SHA-256 `fc56b05db906c477ed41f3d2bdb27ad66703b5d8de6c66eb986c18b6733bc383`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(
        page.getByRole("rowheader", { name: "Consulting", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:511:15

[apps/web/e2e/services.spec.ts:511](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:511); SHA-256 `860229f72e7505512fc77fb4c3c473dda423391fd6829683d394e8a64b58367f`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(
          dialog.getByRole("button", { name: "Save Changes" }),
        ).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:516:7

[apps/web/e2e/services.spec.ts:516](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:516); SHA-256 `1103c41155e5308c96886569a90b1c85fe4108dbac62da202dab527486b51b84`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(updates).toEqual([])
```

### apps/web/e2e/services.spec.ts:518:13

[apps/web/e2e/services.spec.ts:518](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:518); SHA-256 `78c37ebe447117d9701081562f5d9f40d9fe578d0b5dbc1edeee2306fa96dd3f`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByRole("alert")).toHaveText("Permission revoked")
```

### apps/web/e2e/services.spec.ts:519:7

[apps/web/e2e/services.spec.ts:519](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:519); SHA-256 `419dfe6c5630f6d9c364d5523872844c9ead6a92a7505f17d45f154d7efb9480`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(updates).toHaveLength(1)
```

### apps/web/e2e/services.spec.ts:524:13

[apps/web/e2e/services.spec.ts:524](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:524); SHA-256 `2f5fe2402491dc0c07f372af32f6fc814fb1ca39f3bfe6593159f34583e84c58`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByLabel("Service Name")).toHaveValue(
        "Updated Consulting",
      )
```

### apps/web/e2e/services.spec.ts:528:13

[apps/web/e2e/services.spec.ts:528](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:528); SHA-256 `fc56b05db906c477ed41f3d2bdb27ad66703b5d8de6c66eb986c18b6733bc383`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(
        page.getByRole("rowheader", { name: "Consulting", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:546:15

[apps/web/e2e/services.spec.ts:546](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:546); SHA-256 `5bc612a5c93be58ef9426aa26d321ee8c949642125d1bc1cee4a0804b6019645`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByLabel("Package Name")).toHaveCount(1)
```

### apps/web/e2e/services.spec.ts:547:15

[apps/web/e2e/services.spec.ts:547](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:547); SHA-256 `78763a62dd1275faf913446d116b4b687cc3d89bb5e0cd83e9fc5a6fdc4c842f`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByLabel("Package Name")).toHaveValue("Starter")
```

### apps/web/e2e/services.spec.ts:551:15

[apps/web/e2e/services.spec.ts:551](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:551); SHA-256 `2b412a2c8f01577ba3c397c68844d821499e3bd21333ced7b52dc0c1cbc0ccf2`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByRole("alert")).toHaveText(
          "Add at least two packages, or choose Pricing for a single option",
        )
```

### apps/web/e2e/services.spec.ts:554:9

[apps/web/e2e/services.spec.ts:554](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:554); SHA-256 `419dfe6c5630f6d9c364d5523872844c9ead6a92a7505f17d45f154d7efb9480`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(updates).toHaveLength(1)
```

### apps/web/e2e/services.spec.ts:578:9

[apps/web/e2e/services.spec.ts:578](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:578); SHA-256 `622d7058f9afcc162b74b4f738dd542ae90900383a2137660768ce1c93fd79b9`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(body.packages.map((item) => item.name)).toEqual([
          "Starter",
          "Replacement",
        ])
```

### apps/web/e2e/services.spec.ts:582:15

[apps/web/e2e/services.spec.ts:582](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:582); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/services.spec.ts:590:15

[apps/web/e2e/services.spec.ts:590](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:590); SHA-256 `a1369983001ec7819c9a484356961770db2011867431f6d16b3b9971db411b25`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByLabel("Package Name")).toHaveCount(2)
```

### apps/web/e2e/services.spec.ts:591:15

[apps/web/e2e/services.spec.ts:591](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:591); SHA-256 `66803490dc20debdbf67782bfef016e0ef121718de7bfe4defb676410d763c04`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByLabel("Package Name").nth(0)).toHaveValue(
          "Starter",
        )
```

### apps/web/e2e/services.spec.ts:594:15

[apps/web/e2e/services.spec.ts:594](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:594); SHA-256 `7b4f2ebc0105bb78742c2bb7e0294266867f9975c611c3cfa2475e103399575f`.

Direct callback owners: PW-258, PW-259.

All possible owners, including helper/route/hook candidates: PW-258, PW-259.

```ts
expect(dialog.getByLabel("Package Name").nth(1)).toHaveValue(
          "Replacement",
        )
```

### apps/web/e2e/services.spec.ts:615:11

[apps/web/e2e/services.spec.ts:615](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:615); SHA-256 `290f9020cf9657fe2d82099ac1d8e856eb9fa725b1aa38992fcfbeab01b680a8`.

Direct callback owners: PW-260.

All possible owners, including helper/route/hook candidates: PW-260.

```ts
expect(
      page.getByText("Create a department before creating a service."),
    ).toBeVisible()
```

### apps/web/e2e/services.spec.ts:618:11

[apps/web/e2e/services.spec.ts:618](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:618); SHA-256 `76bf4fe9e832ef9ddeeb594a45393504dfde4b954e30a6a3f92979ae9432c968`.

Direct callback owners: PW-260.

All possible owners, including helper/route/hook candidates: PW-260.

```ts
expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
```

## apps/web/e2e/session-revocation.spec.ts

### apps/web/e2e/session-revocation.spec.ts:93:11

[apps/web/e2e/session-revocation.spec.ts:93](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:93); SHA-256 `d391e432ead5ecbdab9ac3b870f1ab9bae70107719a61e3da467d7f6b35dfb04`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-261, PW-262.

```ts
expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/session-revocation.spec.ts:115:9

[apps/web/e2e/session-revocation.spec.ts:115](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:115); SHA-256 `46722cd7fb65d5edac877cff3b73912cd1a159ef50c073f6f7a140f81b943633`.

Direct callback owners: (helper/hook site).

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(
    page.getByRole("dialog", { name: "Password changed", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/session-revocation.spec.ts:131:5

[apps/web/e2e/session-revocation.spec.ts:131](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:131); SHA-256 `19af9c8ecdd6432e9fcc4d6e7c2bd88e583361796116cc14921cc0e2c70dffdf`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(state.active.size).toBe(2)
```

### apps/web/e2e/session-revocation.spec.ts:132:5

[apps/web/e2e/session-revocation.spec.ts:132](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:132); SHA-256 `538b3c2c81474f05b90360b2ead62feb384aa865392b991741ab7d11c774df47`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(state.revokeAllCalls).toBe(0)
```

### apps/web/e2e/session-revocation.spec.ts:133:11

[apps/web/e2e/session-revocation.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:133); SHA-256 `d864bf7388938c97057eb242f6f7d2d4e7e1f58a0dc7ef056eee324c7f1b197e`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(pageA).toHaveURL(/\/settings/)
```

### apps/web/e2e/session-revocation.spec.ts:136:11

[apps/web/e2e/session-revocation.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:136); SHA-256 `5d2f9b5e571a6f32127e5f38dbe85ef605e3920da038b71e253088b1c3a50575`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(
      pageB.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/session-revocation.spec.ts:139:5

[apps/web/e2e/session-revocation.spec.ts:139](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:139); SHA-256 `9a02c8e297d74a92e58ff3861b6d2c181e7d70933e49f21282d8ffc8a98e39b1`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(
      await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("b")
```

### apps/web/e2e/session-revocation.spec.ts:149:11

[apps/web/e2e/session-revocation.spec.ts:149](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:149); SHA-256 `2f34e56bb58c05d00d632f062ca597eb917dbfbb867eb8d78f9f292f3b9e4537`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(confirm).toContainText("including this one")
```

### apps/web/e2e/session-revocation.spec.ts:151:5

[apps/web/e2e/session-revocation.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:151); SHA-256 `538b3c2c81474f05b90360b2ead62feb384aa865392b991741ab7d11c774df47`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(state.revokeAllCalls).toBe(0)
```

### apps/web/e2e/session-revocation.spec.ts:152:5

[apps/web/e2e/session-revocation.spec.ts:152](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:152); SHA-256 `19af9c8ecdd6432e9fcc4d6e7c2bd88e583361796116cc14921cc0e2c70dffdf`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(state.active.size).toBe(2)
```

### apps/web/e2e/session-revocation.spec.ts:157:11

[apps/web/e2e/session-revocation.spec.ts:157](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:157); SHA-256 `197ce947ca723989e00c52ec90c86b2fee3ab34ad392afa085014162d289c2b8`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(pageA).toHaveURL(/\/login/)
```

### apps/web/e2e/session-revocation.spec.ts:158:5

[apps/web/e2e/session-revocation.spec.ts:158](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:158); SHA-256 `ab46c99f41e1a820a998cce8433694d7702faf37a519823e84d17d518903dce7`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(state.revokeAllCalls).toBe(1)
```

### apps/web/e2e/session-revocation.spec.ts:159:5

[apps/web/e2e/session-revocation.spec.ts:159](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:159); SHA-256 `3cbebeb940154c67e086f09c18e304a79cca0b243fc99404954c84b5daa125cc`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(
      await pageA.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/session-revocation.spec.ts:164:11

[apps/web/e2e/session-revocation.spec.ts:164](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:164); SHA-256 `60bb21d28c452e94f1db3e776fe1e6cdcccd65253f167de936b1f1e514662cfc`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(pageB).toHaveURL(/\/login/, { timeout: 10000 })
```

### apps/web/e2e/session-revocation.spec.ts:165:5

[apps/web/e2e/session-revocation.spec.ts:165](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:165); SHA-256 `52ae40eaf0836c448200500faa6d498dd985a71989aea75af70dce8c3a7d6542`.

Direct callback owners: PW-261.

All possible owners, including helper/route/hook candidates: PW-261.

```ts
expect(
      await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/session-revocation.spec.ts:186:13

[apps/web/e2e/session-revocation.spec.ts:186](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:186); SHA-256 `1ad392504ec5896d14118c54bf30c9f208f6d9a4f442500c5d328f2e091424df`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect.poll(() => state.meCallsB).toBeGreaterThan(before)
```

### apps/web/e2e/session-revocation.spec.ts:187:13

[apps/web/e2e/session-revocation.spec.ts:187](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:187); SHA-256 `74bd77b6f71d067f39fc6f871bc3add66b98f39c345aa161b6e71dc77d80473c`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect(pageB).toHaveURL(/\/settings/)
```

### apps/web/e2e/session-revocation.spec.ts:188:7

[apps/web/e2e/session-revocation.spec.ts:188](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:188); SHA-256 `07b74bdda3db79175422fec0455ee247173943d9c01d974f847b07d97a6370a7`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect(
        await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("b")
```

### apps/web/e2e/session-revocation.spec.ts:199:11

[apps/web/e2e/session-revocation.spec.ts:199](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:199); SHA-256 `b6ae07af892a25aea60027230813f3a4c88de2cfa9e0d5045f25c88016209a33`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect.poll(() => state.active.has("b")).toBe(false)
```

### apps/web/e2e/session-revocation.spec.ts:202:11

[apps/web/e2e/session-revocation.spec.ts:202](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:202); SHA-256 `60bb21d28c452e94f1db3e776fe1e6cdcccd65253f167de936b1f1e514662cfc`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect(pageB).toHaveURL(/\/login/, { timeout: 10000 })
```

### apps/web/e2e/session-revocation.spec.ts:203:5

[apps/web/e2e/session-revocation.spec.ts:203](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:203); SHA-256 `52ae40eaf0836c448200500faa6d498dd985a71989aea75af70dce8c3a7d6542`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect(
      await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
```

### apps/web/e2e/session-revocation.spec.ts:206:11

[apps/web/e2e/session-revocation.spec.ts:206](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:206); SHA-256 `d864bf7388938c97057eb242f6f7d2d4e7e1f58a0dc7ef056eee324c7f1b197e`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect(pageA).toHaveURL(/\/settings/)
```

### apps/web/e2e/session-revocation.spec.ts:207:5

[apps/web/e2e/session-revocation.spec.ts:207](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:207); SHA-256 `7d35a64fb0f3f120094f0c02de7c0ab7e2a39e2107765f9e4715852abba22de5`.

Direct callback owners: PW-262.

All possible owners, including helper/route/hook candidates: PW-262.

```ts
expect(state.active.has("a")).toBe(true)
```

## apps/web/e2e/settings.spec.ts

### apps/web/e2e/settings.spec.ts:85:13

[apps/web/e2e/settings.spec.ts:85](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:85); SHA-256 `d2f352d7e87c8ce2abcc5360d2496cd8f9124d12712f49bf72ad39f1cedfba9d`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("heading", { name: "Settings", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:88:13

[apps/web/e2e/settings.spec.ts:88](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:88); SHA-256 `fd070544182c0b8fc727bc3af52eeb88373a16dc00f6f408d2c4a6ff952bd394`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("Windows · Edge", { exact: true }).first(),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:91:13

[apps/web/e2e/settings.spec.ts:91](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:91); SHA-256 `cfda4c758ba129a5bed3896b474d5bdea18a0d017efa84c76eee8f8ffc2faf6c`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("Quezon City, Philippines · Approximate location", {
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:96:13

[apps/web/e2e/settings.spec.ts:96](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:96); SHA-256 `52111ef950ac238aeae99d16fbcf9e18f460d66b2f1fdfbef279d820df0abaea`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("Location unavailable", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:101:7

[apps/web/e2e/settings.spec.ts:101](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:101); SHA-256 `00c642fc2b56642637692fc696dfc144d8ddb3e4ceb2ace7389734bb9a0d8be6`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(topbar).not.toBeNull()
```

### apps/web/e2e/settings.spec.ts:102:7

[apps/web/e2e/settings.spec.ts:102](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:102); SHA-256 `d52ad86f74efa85a92dd8c7b2b79d6dd8111744e89d4d2800eb31a50b0977052`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(settingsMain).not.toBeNull()
```

### apps/web/e2e/settings.spec.ts:103:7

[apps/web/e2e/settings.spec.ts:103](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:103); SHA-256 `91e24fd0e0e3b8465cf87eff0de18d01d8b2081fd2a4e5becad5ebd92af5c354`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        settingsMain!.y - (topbar!.y + topbar!.height),
      ).toBeGreaterThanOrEqual(12)
```

### apps/web/e2e/settings.spec.ts:110:13

[apps/web/e2e/settings.spec.ts:110](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:110); SHA-256 `65648abf933983dfe6df322a93d549bf0c051271a1057c56057545d26d931f99`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("tab", { name: "General", exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/settings.spec.ts:119:13

[apps/web/e2e/settings.spec.ts:119](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:119); SHA-256 `d001405a92d41468770c0ea09ccaa6fb14c3ef444114160bcec9a494b150cc1f`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("tab", { name: "Notifications", exact: true }),
      ).toHaveAttribute("aria-selected", "true")
```

### apps/web/e2e/settings.spec.ts:125:13

[apps/web/e2e/settings.spec.ts:125](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:125); SHA-256 `c7be5255acc0e8ebf9469dce61071f59c2c7aefa228e894b471bf8d9090c5691`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("tab", { name: "Security", exact: true }),
      ).toHaveAttribute("aria-selected", "true")
```

### apps/web/e2e/settings.spec.ts:131:13

[apps/web/e2e/settings.spec.ts:131](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:131); SHA-256 `2d3214c1a883164dd13a4655249438490c8a0649c4224d873800851570444ccf`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("dialog", { name: "Change password", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:137:7

[apps/web/e2e/settings.spec.ts:137](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:137); SHA-256 `05203b5917b5f5d46a25887c4ad2894f9eb2f3c32eb14314e6fe48f1c1af0d26`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(items).toEqual(["Profile", "Settings", "Log out"])
```

### apps/web/e2e/settings.spec.ts:140:13

[apps/web/e2e/settings.spec.ts:140](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:140); SHA-256 `6e25a65ba51d389bfc72a843a682d1c3dcf1182ba96bb7c8f87955c57a616926`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(page.getByRole("dialog")).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:141:13

[apps/web/e2e/settings.spec.ts:141](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:141); SHA-256 `ee54511957332e24634b53c962217dbe0a2047c049cf76578f719a0b178d8c86`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("iPhone · Safari", { exact: true }),
      ).toHaveCount(2)
```

### apps/web/e2e/settings.spec.ts:148:13

[apps/web/e2e/settings.spec.ts:148](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:148); SHA-256 `85902fe031bf580cfc06598b650f7cddb9111822e8d45cab8cc96619fc920ec2`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("iPhone · Safari", { exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/settings.spec.ts:151:13

[apps/web/e2e/settings.spec.ts:151](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:151); SHA-256 `c5c1e55ee63381ccfeee1fc134da92ea33897bc2dfe9adf083af7f79892c1942`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("Current session", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:159:13

[apps/web/e2e/settings.spec.ts:159](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:159); SHA-256 `9dcf4d9d026a65231cefd21d4fd084086e633578a5e2c00600800d263cec00ca`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect
        .poll(() => state.preferences.workflowNotifications)
        .toBe(false)
```

### apps/web/e2e/settings.spec.ts:179:13

[apps/web/e2e/settings.spec.ts:179](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:179); SHA-256 `9dfb6a0f0042c1bab42cf935bcf1aa3f89eec144ba6f9e5edeeda679bb9c01b4`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect.poll(() => state.preferences.timeZone).toBe("UTC")
```

### apps/web/e2e/settings.spec.ts:180:13

[apps/web/e2e/settings.spec.ts:180](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:180); SHA-256 `37cb5f065907f957c9a5331b7ad717444af385d8d5f732bdfcdcec9e18f144e0`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("heading", { name: "Time preview", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:189:13

[apps/web/e2e/settings.spec.ts:189](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:189); SHA-256 `5db2a214e48fae0ee0f7ea71cec7c8887f5d760c0a06c9afff216824bb251136`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("combobox", { name: "Time zone", exact: true }),
      ).toHaveValue("UTC")
```

### apps/web/e2e/settings.spec.ts:193:13

[apps/web/e2e/settings.spec.ts:193](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:193); SHA-256 `2ddc68b6f661a5395e0a2093b3fabe043a6dd56a2de2f1b85fb1a00df3eef130`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByText("Last active 2026-11-02, 08:15", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:201:13

[apps/web/e2e/settings.spec.ts:201](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:201); SHA-256 `edf6b0b8cc4064a5536034319c75342a5f0ad61a5253e86c0cd26578a7b46834`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect
        .poll(
          async () =>
            (
              await page
                .getByRole("heading", { name: "Settings", exact: true })
                .boundingBox()
            )?.x ?? 999,
        )
        .toBeLessThan(50)
```

### apps/web/e2e/settings.spec.ts:216:7

[apps/web/e2e/settings.spec.ts:216](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:216); SHA-256 `82e8c0b412dc8cf4a7f7785fe4bf7a7ee5b91ccf05211652559cc4598f215e15`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(mobileMain?.x).toBeLessThan(20)
```

### apps/web/e2e/settings.spec.ts:217:7

[apps/web/e2e/settings.spec.ts:217](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:217); SHA-256 `3f17efa94f7730706c276251b681671670a595adde9bcbba8e6f49ce6ce8dfe2`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(mobileMain?.width).toBeGreaterThanOrEqual(350)
```

### apps/web/e2e/settings.spec.ts:219:7

[apps/web/e2e/settings.spec.ts:219](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:219); SHA-256 `b6d0f6acbdd53d6ce1b4a36db1231da4b4ec898aff185f7c3d71577690ed200b`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        mobileMain!.y - (mobileTopbar!.y + mobileTopbar!.height),
      ).toBeGreaterThanOrEqual(12)
```

### apps/web/e2e/settings.spec.ts:225:13

[apps/web/e2e/settings.spec.ts:225](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:225); SHA-256 `9fe4a38e8bb89e60578461e5f6dad90f50ea3974eb6e3e75c2e9c4a6cbe311d1`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("heading", {
          name: "In-app notifications",
          exact: true,
        }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:236:13

[apps/web/e2e/settings.spec.ts:236](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:236); SHA-256 `6292aba8b2b4e57210b1b04c53c3595703168f3c69e34a4edd7aa64d6dc11e42`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("heading", { name: "Date and time", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:244:7

[apps/web/e2e/settings.spec.ts:244](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:244); SHA-256 `ffae9077477b477a163789b1aba00015e8ddc857ae6862f9f303992909163ea6`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
```

### apps/web/e2e/settings.spec.ts:264:13

[apps/web/e2e/settings.spec.ts:264](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:264); SHA-256 `d57bb59267284670423e449aa9b1b7f96767557cc38ba31446d19dc96a24b22b`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page
          .getByRole("alert")
          .filter({ hasText: "The new passwords do not match." }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:269:7

[apps/web/e2e/settings.spec.ts:269](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:269); SHA-256 `c96ed8a32df97e7b39ecb5c53223d4cb634e5d26d9d72ac1e9955e80b33aa4a4`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(changedPassword).toBe(false)
```

### apps/web/e2e/settings.spec.ts:276:13

[apps/web/e2e/settings.spec.ts:276](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:276); SHA-256 `341e6562bb5647ac72d6240338e9f8692670411b986961a75e66ef2f23d97d47`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect.poll(() => changedPassword).toBe(true)
```

### apps/web/e2e/settings.spec.ts:278:13

[apps/web/e2e/settings.spec.ts:278](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:278); SHA-256 `2d3214c1a883164dd13a4655249438490c8a0649c4224d873800851570444ccf`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("dialog", { name: "Change password", exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/settings.spec.ts:282:13

[apps/web/e2e/settings.spec.ts:282](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:282); SHA-256 `5665580f3d7e05688b39a5425ea238a06187d2f88edfc8eb9d1ad69d3d01e075`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        page.getByRole("dialog", { name: "Password changed", exact: true }),
      ).toContainText("Do you want to log out of all devices?")
```

### apps/web/e2e/settings.spec.ts:286:13

[apps/web/e2e/settings.spec.ts:286](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:286); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/settings.spec.ts:287:13

[apps/web/e2e/settings.spec.ts:287](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:287); SHA-256 `560b728ae4a75c88ecfe6354692a8aaf9cbc1e41f22766b1e8ca9410fef561f8`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(page).toHaveURL(/\/settings/)
```

### apps/web/e2e/settings.spec.ts:288:7

[apps/web/e2e/settings.spec.ts:288](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:288); SHA-256 `ae549ccd0fd04c58da2e40c8a66d1a98934be85c32939f867a1b59ec5de26e3c`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(changedPassword).toBe(true)
```

### apps/web/e2e/settings.spec.ts:289:7

[apps/web/e2e/settings.spec.ts:289](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:289); SHA-256 `95b9aa8c388e0e4d5fc1e51948c9c62bc0374667db8f2faa12b4e2b2ad149b80`.

Direct callback owners: PW-263, PW-264, PW-265, PW-266.

All possible owners, including helper/route/hook candidates: PW-263, PW-264, PW-265, PW-266.

```ts
expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("settings-test")
```

## apps/web/e2e/staff-workload.spec.ts

### apps/web/e2e/staff-workload.spec.ts:30:7

[apps/web/e2e/staff-workload.spec.ts:30](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:30); SHA-256 `5577f51dedeb6a8417aaa6cf39ff423b08ebd574fc19b494256616ca2715ddbb`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(route.request().postDataJSON()).toMatchObject({
        employeeId: "maria",
        scheduledHours: 40,
        timeOffHours: 8,
      })
```

### apps/web/e2e/staff-workload.spec.ts:39:7

[apps/web/e2e/staff-workload.spec.ts:39](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:39); SHA-256 `6f6ba10c183a01b9a43680f10215fd14d4104cce96ef3bc6ed864536bdfd590d`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(route.request().postDataJSON()).toMatchObject({
        employeeId: "maria",
        projectId: "project-1",
        weeklyHours: 10,
        endDate: "2026-11-09",
      })
```

### apps/web/e2e/staff-workload.spec.ts:120:9

[apps/web/e2e/staff-workload.spec.ts:120](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:120); SHA-256 `9dd7235417662d87069c2b06be9ed077cc5439d47acc2bf4e009edf3d94c4cf3`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:123:9

[apps/web/e2e/staff-workload.spec.ts:123](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:123); SHA-256 `852ba25d93a09a297524e74b8a5dd03c5f487d2c9ba041d64c5e5d1488a3fb25`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page
      .getByRole("region", { name: "Staff workload table", exact: true })
      .getByText("Needs setup", { exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:135:7

[apps/web/e2e/staff-workload.spec.ts:135](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:135); SHA-256 `7d7960bdb61de9352383b0a5fadc86bbe931f651d24428c84441c45d6af35058`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(height).toBeGreaterThanOrEqual(108)
```

### apps/web/e2e/staff-workload.spec.ts:136:7

[apps/web/e2e/staff-workload.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:136); SHA-256 `ec2b7da5e914b59444f2ab02b30bfce467b381ec763c2e8d18dee34c989cca6c`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(height).toBeLessThanOrEqual(110)
```

### apps/web/e2e/staff-workload.spec.ts:139:9

[apps/web/e2e/staff-workload.spec.ts:139](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:139); SHA-256 `f667bc91ab14f3fe5681c3605fcbd193f4b9e4561bb65547575f160775a28aa1`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(overview.getByRole("article")).toHaveCount(4)
```

### apps/web/e2e/staff-workload.spec.ts:141:9

[apps/web/e2e/staff-workload.spec.ts:141](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:141); SHA-256 `017406af4402620e5a7203bace2e9532f5d9523dd56dc24ece9d91b87dbcbde6`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Staff by status: Active: 1; On leave: 0; Inactive: 0",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:147:9

[apps/web/e2e/staff-workload.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:147); SHA-256 `563c64221b1d82353f7da3ccf1852faa66293a1c5ba82c7735db5fad2fca4c59`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Record capacity and assignment hours to view utilization.",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:153:9

[apps/web/e2e/staff-workload.spec.ts:153](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:153); SHA-256 `17e0486f80d2c0a87d37795872e76306bab49a8f9a9b598cba6146e85a516e19`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("button", { name: "Refresh workload" }),
  ).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:156:9

[apps/web/e2e/staff-workload.spec.ts:156](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:156); SHA-256 `2212e44272ced4563e2f4904934e2fa4215f4d820e643c0f05178e1f728690b8`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("button", { name: "Workload actions" }),
  ).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:160:9

[apps/web/e2e/staff-workload.spec.ts:160](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:160); SHA-256 `4b37caba8aa0641dd814ccb8fdb3e11b8853ff955e5138aebb9df54ed4d020a0`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(weekButton).toHaveAccessibleName(
    "Change workload week, starting November 2, 2026",
  )
```

### apps/web/e2e/staff-workload.spec.ts:163:9

[apps/web/e2e/staff-workload.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:163); SHA-256 `4fbb11982b606930129c5c2648e98b4d7e7e1059488d27a93fe0330e47b0b473`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(weekButton).toHaveText("")
```

### apps/web/e2e/staff-workload.spec.ts:172:11

[apps/web/e2e/staff-workload.spec.ts:172](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:172); SHA-256 `86e9b1c3d3bff7833a5492af184c8a298188ca8c0fa32be3252cca9ae81c4c48`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendar).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:174:9

[apps/web/e2e/staff-workload.spec.ts:174](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:174); SHA-256 `b2387ba1130a3eee9e53cd67a5cbe7270d07dae1f84a031f2d561779d3bddd9c`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    calendar.getByRole("grid", { name: "November 2026" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:180:9

[apps/web/e2e/staff-workload.spec.ts:180](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:180); SHA-256 `9512c5d345db6f2b5e0aba694b8613b5548934272f47440338ef5bc1f9672025`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    calendar.getByRole("grid", { name: "December 2026" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:194:9

[apps/web/e2e/staff-workload.spec.ts:194](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:194); SHA-256 `1dad870ac9c09b9e9cb0b845f82d5606761d162f8f066cd744a4deb23d7e8486`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    calendar.getByRole("button", {
      name: "Thursday, November 5, 2026",
      exact: true,
    }),
  ).toBeFocused()
```

### apps/web/e2e/staff-workload.spec.ts:201:9

[apps/web/e2e/staff-workload.spec.ts:201](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:201); SHA-256 `86e9b1c3d3bff7833a5492af184c8a298188ca8c0fa32be3252cca9ae81c4c48`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendar).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:202:9

[apps/web/e2e/staff-workload.spec.ts:202](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:202); SHA-256 `4b37caba8aa0641dd814ccb8fdb3e11b8853ff955e5138aebb9df54ed4d020a0`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(weekButton).toHaveAccessibleName(
    "Change workload week, starting November 2, 2026",
  )
```

### apps/web/e2e/staff-workload.spec.ts:205:9

[apps/web/e2e/staff-workload.spec.ts:205](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:205); SHA-256 `b19439718cacde84f13fb3ab7d2fa1a2228297eccd2b34758fa36df6e9cb9a98`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(weekButton).toBeFocused()
```

### apps/web/e2e/staff-workload.spec.ts:211:9

[apps/web/e2e/staff-workload.spec.ts:211](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:211); SHA-256 `6b4a41a70f8ee0d9bbef04d07a4bed250f0e06570698f598dde6fec7fd031760`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("region", { name: "Capacity calculation" }),
  ).toContainText("40 hrs − 8 hrs = 32 hrs")
```

### apps/web/e2e/staff-workload.spec.ts:215:9

[apps/web/e2e/staff-workload.spec.ts:215](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:215); SHA-256 `e9a6243823c40826363cfeeb248ff1cc0ac78d8626902cec48e6e58f6a1dfc74`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByText("Time off cannot exceed scheduled hours.", { exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:219:3

[apps/web/e2e/staff-workload.spec.ts:219](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:219); SHA-256 `b36735cc27492e5af9731057f5df88d96ed59286a08c2cc21aed39b243dcded1`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(saved).toBe(false)
```

### apps/web/e2e/staff-workload.spec.ts:221:9

[apps/web/e2e/staff-workload.spec.ts:221](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:221); SHA-256 `4e021f2da635e67b9e069ad4edf58e83794070a4e273a29a6486842b9759a097`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(timeOff).toBeFocused()
```

### apps/web/e2e/staff-workload.spec.ts:222:9

[apps/web/e2e/staff-workload.spec.ts:222](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:222); SHA-256 `0ac43a8878869f916aacf2fe5c7adad2cf8df5f0a27728f4b0e3424cff72ab20`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(timeOff).toHaveAccessibleDescription(
    /Enter a value of 40 or less\./,
  )
```

### apps/web/e2e/staff-workload.spec.ts:225:9

[apps/web/e2e/staff-workload.spec.ts:225](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:225); SHA-256 `d95a1b74cbb3a6d52082044dcbace6292266f8e4287d58f0957abcc855289a51`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(timeOff).toHaveCSS("border-color", "rgb(214, 69, 87)")
```

### apps/web/e2e/staff-workload.spec.ts:226:9

[apps/web/e2e/staff-workload.spec.ts:226](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:226); SHA-256 `725d3cfbfa9f15e1ab12ba907bcc45de442804cf67af1c186d92d14377d7d3a6`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page
      .locator("[data-field-error]")
      .filter({ hasText: "Enter a value of 40 or less." }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:232:9

[apps/web/e2e/staff-workload.spec.ts:232](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:232); SHA-256 `dcaed8f65a9ec0bbefdcf143d4eb40be7af8d8fa1c85b4cbc28bf6d3bb35aeca`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(timeOff).not.toHaveAttribute("aria-invalid", "true")
```

### apps/web/e2e/staff-workload.spec.ts:233:9

[apps/web/e2e/staff-workload.spec.ts:233](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:233); SHA-256 `d064692881179933358128fab603d8e378573719399f91825d6f275dfd248ec7`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(timeOff).toHaveAttribute("aria-describedby", "capacity-help")
```

### apps/web/e2e/staff-workload.spec.ts:239:9

[apps/web/e2e/staff-workload.spec.ts:239](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:239); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:240:9

[apps/web/e2e/staff-workload.spec.ts:240](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:240); SHA-256 `b5eda78e2eac4278cc4183e4f4c57afc8ef9379df4f883bb5b644e73895aa559`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByText("0 / 32 hrs", { exact: true })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:242:9

[apps/web/e2e/staff-workload.spec.ts:242](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:242); SHA-256 `7de3f3335d2ca4a3be32001c45046861208397b6ecefa7f29f927f39335f7f6c`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByText("No assignments this week.")).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:243:9

[apps/web/e2e/staff-workload.spec.ts:243](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:243); SHA-256 `282ddcad02a7e84983fb449a4fe3713f453e026ccc12bce39cb73616f22211a7`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByRole("dialog")).toHaveCSS("opacity", "1")
```

### apps/web/e2e/staff-workload.spec.ts:253:9

[apps/web/e2e/staff-workload.spec.ts:253](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:253); SHA-256 `5b583c62bc5e96a7c5d5fe53ae3bf66388409eefcf1541e577be616289a1ef25`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Edit weekly capacity" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:264:9

[apps/web/e2e/staff-workload.spec.ts:264](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:264); SHA-256 `9ee152913ad867cc3d8666eaa49cfb144b491de59f2c33d9baea21b0cac5683d`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(staffingDialog).toContainText("Website Design and Development")
```

### apps/web/e2e/staff-workload.spec.ts:265:9

[apps/web/e2e/staff-workload.spec.ts:265](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:265); SHA-256 `0140bfaafb5b90412adacfec33793c29210320fc1318863138f56de932c472d0`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(staffingDialog).toContainText(
    "SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01",
  )
```

### apps/web/e2e/staff-workload.spec.ts:275:9

[apps/web/e2e/staff-workload.spec.ts:275](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:275); SHA-256 `f3f47c30b7c15f4cd73c2ac9323add865416203888c1be13a510e5d3d37f0ca8`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    assignmentDialog.getByRole("combobox", { name: "Project", exact: true }),
  ).toContainText("Website Design and Development")
```

### apps/web/e2e/staff-workload.spec.ts:278:9

[apps/web/e2e/staff-workload.spec.ts:278](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:278); SHA-256 `39ccffb1bb5d00725e141887add1bd2cd5c68ffbfd6e3590183975aaf5e7a47e`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    assignmentDialog.getByRole("combobox", { name: "Project", exact: true }),
  ).toContainText("SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01")
```

### apps/web/e2e/staff-workload.spec.ts:288:9

[apps/web/e2e/staff-workload.spec.ts:288](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:288); SHA-256 `762f1255eb0b3db8bc1d1be887ed842833e9ba587b959ee072c14199cd749f39`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("button", { name: "More actions for Maria Santos" }),
  ).toBeFocused()
```

### apps/web/e2e/staff-workload.spec.ts:301:9

[apps/web/e2e/staff-workload.spec.ts:301](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:301); SHA-256 `e8baaff8bf66956afef053bbc73d011e7ff32f167aada3a410aa98127ebf66cc`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(projectOption).toContainText(
    "SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01",
  )
```

### apps/web/e2e/staff-workload.spec.ts:310:9

[apps/web/e2e/staff-workload.spec.ts:310](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:310); SHA-256 `d02ec514a37661518e720b8f9f947ff6999eab173cc620a25b534b0e1b3ff24a`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    calendar.getByRole("button", {
      name: "Sunday, November 1, 2026",
      exact: true,
    }),
  ).toBeDisabled()
```

### apps/web/e2e/staff-workload.spec.ts:319:9

[apps/web/e2e/staff-workload.spec.ts:319](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:319); SHA-256 `86e9b1c3d3bff7833a5492af184c8a298188ca8c0fa32be3252cca9ae81c4c48`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendar).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:320:9

[apps/web/e2e/staff-workload.spec.ts:320](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:320); SHA-256 `50f75f82c88f2fb30c7fe0f2cd8497bf173c230051d0dcd15bf3fd173153c578`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-11-09",
  )
```

### apps/web/e2e/staff-workload.spec.ts:323:9

[apps/web/e2e/staff-workload.spec.ts:323](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:323); SHA-256 `ba46598cd639be16d2156b92b1d31fd1061ecc1395a10429e884a75f17230334`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByText(/Projected utilization: 10 \/ 32 hrs/),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:332:9

[apps/web/e2e/staff-workload.spec.ts:332](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:332); SHA-256 `b4aadad8eaa175bf7d02464f6f357efd987187f1088510a68c3b8378998cb522`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect
    .poll(async () => (await assignmentDialog.boundingBox())?.width)
    .toBeLessThanOrEqual(362)
```

### apps/web/e2e/staff-workload.spec.ts:336:3

[apps/web/e2e/staff-workload.spec.ts:336](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:336); SHA-256 `8b7a4af4d2448b36d7efc1b6b52be5f0ef63f22c329a1d0c9e6371de07a44cd4`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(dialogBounds!.x).toBeGreaterThanOrEqual(14)
```

### apps/web/e2e/staff-workload.spec.ts:337:3

[apps/web/e2e/staff-workload.spec.ts:337](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:337); SHA-256 `1faffad269a5530c3edb2185678fb7aaaac3672c9d920122d25d173cd811ad6f`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(376)
```

### apps/web/e2e/staff-workload.spec.ts:338:3

[apps/web/e2e/staff-workload.spec.ts:338](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:338); SHA-256 `1c8bc97c2f2e55760fddb1f3d892c4a801d6b29bf5595af47446dffb614c6a65`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    await assignmentDialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
```

### apps/web/e2e/staff-workload.spec.ts:349:9

[apps/web/e2e/staff-workload.spec.ts:349](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:349); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:350:9

[apps/web/e2e/staff-workload.spec.ts:350](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:350); SHA-256 `b17962cdaccfd59ee123bd827705bb6bcca59fece7cb714558155a00dbfd48ab`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByText("10 / 32 hrs", { exact: true })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:351:9

[apps/web/e2e/staff-workload.spec.ts:351](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:351); SHA-256 `7656a07a13469fce9747ae24d0770aeaa59db47deb38b3beb497cb1f867a15f9`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Weekly utilization: 10 hours assigned against 32 hours capacity; 1 of 1 active staff have complete hours",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:357:9

[apps/web/e2e/staff-workload.spec.ts:357](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:357); SHA-256 `7c2e26275d7d79465ca25f9e0e89df46d2c6811e69481e1cdec2f693519d9569`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Active staff availability: Available: 1; Limited capacity: 0; Needs setup: 0",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:366:9

[apps/web/e2e/staff-workload.spec.ts:366](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:366); SHA-256 `e377fb2cd6b4630e6e5e5e8048c54ab29356ff9dd74a38d22ebd905feb599682`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("menuitem", { name: "Manage assignments", exact: true }),
  ).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:370:9

[apps/web/e2e/staff-workload.spec.ts:370](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:370); SHA-256 `24ccbfdfeda167f92212526df7303d1d201710172d66b468bb7c09df29dab5d2`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Reassign / edit allocation" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:378:9

[apps/web/e2e/staff-workload.spec.ts:378](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:378); SHA-256 `17e85b35a5778d42ec50d12d388164f8f14e08cba2eaacffe55b4e0354316d6d`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Unassign staff?" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:384:9

[apps/web/e2e/staff-workload.spec.ts:384](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:384); SHA-256 `5fe380d8c9775fe478de7bfa66ec8e96c422aefd35b3d3f1df085afcba1a96e9`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByText("12 / 32 hrs", { exact: true })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:389:9

[apps/web/e2e/staff-workload.spec.ts:389](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:389); SHA-256 `26b539c0692fe5eb1f22f011f42a4daceb183784a6889a742bb49296194e5946`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Choose assignment to unassign" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:393:9

[apps/web/e2e/staff-workload.spec.ts:393](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:393); SHA-256 `17e85b35a5778d42ec50d12d388164f8f14e08cba2eaacffe55b4e0354316d6d`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Unassign staff?" }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:396:9

[apps/web/e2e/staff-workload.spec.ts:396](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:396); SHA-256 `b1063fd7a7fbb4938d0ec2fc3687b8a433e7142d7e99be911520771fce141759`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByRole("dialog")).toContainText("Brand Identity")
```

### apps/web/e2e/staff-workload.spec.ts:399:9

[apps/web/e2e/staff-workload.spec.ts:399](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:399); SHA-256 `282ddcad02a7e84983fb449a4fe3713f453e026ccc12bce39cb73616f22211a7`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByRole("dialog")).toHaveCSS("opacity", "1")
```

### apps/web/e2e/staff-workload.spec.ts:405:9

[apps/web/e2e/staff-workload.spec.ts:405](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:405); SHA-256 `a198b89898c613421fc9d876ea4192257d138db2e0169c917e7e0411d0a2e39f`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByRole("dialog")).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:408:9

[apps/web/e2e/staff-workload.spec.ts:408](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:408); SHA-256 `d4032dc4d2a682a1f6222e0354d5c2e19da895b99313fd72ceef3393414db932`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(weekButton).toHaveAccessibleName(
    "Change workload week, starting November 16, 2026",
  )
```

### apps/web/e2e/staff-workload.spec.ts:411:9

[apps/web/e2e/staff-workload.spec.ts:411](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:411); SHA-256 `1278e5ddfaa7d95dd4dff04ea05a7831b5eb9e724ee90dfc1bcbba231a0ca703`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(page.getByText("50 / 32 hrs", { exact: true })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:412:9

[apps/web/e2e/staff-workload.spec.ts:412](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:412); SHA-256 `4f1b44a9175190fb03cd978c81d8bb3c7319864c2215697627ac2ccdf879fe73`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(overview.getByRole("img")).toHaveCount(4)
```

### apps/web/e2e/staff-workload.spec.ts:413:9

[apps/web/e2e/staff-workload.spec.ts:413](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:413); SHA-256 `3ccf2c6faa3bb8c9c8c720de1c1d38bbde47ff99ff074e11d059328d060940bc`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Hours over capacity: Maria Santos: 18 hours; 18 total excess hours",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:419:9

[apps/web/e2e/staff-workload.spec.ts:419](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:419); SHA-256 `32f0625146006621288c9044e7a59a3ed435a67dd7e5353a70de018239d02116`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(overview.getByText("156%", { exact: true })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:420:9

[apps/web/e2e/staff-workload.spec.ts:420](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:420); SHA-256 `dd12218091e5a78b2e4e4cef67cbe2a47907677906384ac71aaa5a4df6470c36`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(overview.getByText("100%", { exact: true })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:430:9

[apps/web/e2e/staff-workload.spec.ts:430](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:430); SHA-256 `9dd7235417662d87069c2b06be9ed077cc5439d47acc2bf4e009edf3d94c4cf3`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:433:9

[apps/web/e2e/staff-workload.spec.ts:433](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:433); SHA-256 `699ef16bd2deddc46c28ac0445f67afaf2a86fc7499c6c0d66116641e37c0aee`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect
    .poll(async () =>
      page.getByRole("main").evaluate((el) => el.getBoundingClientRect().left),
    )
    .toBeLessThan(25)
```

### apps/web/e2e/staff-workload.spec.ts:438:3

[apps/web/e2e/staff-workload.spec.ts:438](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:438); SHA-256 `af01f3d6d0acb269cb8158cf1175c90a584a0a02ab36d2ba3c38a5f6eb12362a`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
```

### apps/web/e2e/staff-workload.spec.ts:452:9

[apps/web/e2e/staff-workload.spec.ts:452](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:452); SHA-256 `5c5e6f15e145a0854226656102274a999e038b61659b13256a0a4ad7a3479286`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendar).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:454:3

[apps/web/e2e/staff-workload.spec.ts:454](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:454); SHA-256 `8af24e2f926633880bb158c8eee758ad1356d9708e9e4bd689cb301333ce8dad`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendarBounds!.x).toBeGreaterThanOrEqual(8)
```

### apps/web/e2e/staff-workload.spec.ts:455:3

[apps/web/e2e/staff-workload.spec.ts:455](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:455); SHA-256 `aa0b105c70e50396319d8d7c84cb6085b0c118ec959753814c82bd95960e413c`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendarBounds!.x + calendarBounds!.width).toBeLessThanOrEqual(382)
```

### apps/web/e2e/staff-workload.spec.ts:461:9

[apps/web/e2e/staff-workload.spec.ts:461](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:461); SHA-256 `86e9b1c3d3bff7833a5492af184c8a298188ca8c0fa32be3252cca9ae81c4c48`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(calendar).toHaveCount(0)
```

### apps/web/e2e/staff-workload.spec.ts:462:9

[apps/web/e2e/staff-workload.spec.ts:462](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:462); SHA-256 `b19439718cacde84f13fb3ab7d2fa1a2228297eccd2b34758fa36df6e9cb9a98`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(weekButton).toBeFocused()
```

### apps/web/e2e/staff-workload.spec.ts:465:9

[apps/web/e2e/staff-workload.spec.ts:465](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:465); SHA-256 `8a31d74efb4358d0b77e6dcbca6f67da94a8812480ce97cc4380c3d0d65deee3`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Staff by status: Active: 0; On leave: 0; Inactive: 0",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:471:9

[apps/web/e2e/staff-workload.spec.ts:471](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:471); SHA-256 `b389e39a8915ecfa6adc366518c6545c0f2ca9edb964692e1edc4907c13a248e`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Active staff availability: Available: 0; Limited capacity: 0; Needs setup: 0",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:477:9

[apps/web/e2e/staff-workload.spec.ts:477](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:477); SHA-256 `4011ebe02a4c730fb0282d9fcb8439bf043efa37ae07a42f5efdc9ffb191924b`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(
    overview.getByRole("img", {
      name: "Overload data unavailable: no complete hours recorded",
      exact: true,
    }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:483:9

[apps/web/e2e/staff-workload.spec.ts:483](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:483); SHA-256 `e34310f228bf44bdc9276d2ce08b5c4b98a240f3a50127d4b456656616f72b55`.

Direct callback owners: PW-267.

All possible owners, including helper/route/hook candidates: PW-267.

```ts
expect(overview).not.toContainText("NaN")
```

### apps/web/e2e/staff-workload.spec.ts:508:7

[apps/web/e2e/staff-workload.spec.ts:508](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:508); SHA-256 `10383b18169119835e5437720b8a2499a5774b63df04807d65158d3474a8b006`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(route.request().method()).toBe("DELETE")
```

### apps/web/e2e/staff-workload.spec.ts:564:9

[apps/web/e2e/staff-workload.spec.ts:564](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:564); SHA-256 `0ada364cd24addbc19c119c1dba6a68ae0661e3da482d065d9503c4069b495cc`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(attention).toContainText("Former Staff")
```

### apps/web/e2e/staff-workload.spec.ts:565:9

[apps/web/e2e/staff-workload.spec.ts:565](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:565); SHA-256 `543b09683d18bea5b851dfb7572c2642b4da75338f757049e9f58e26e185dcca`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(attention).toContainText("8 hrs/week")
```

### apps/web/e2e/staff-workload.spec.ts:571:9

[apps/web/e2e/staff-workload.spec.ts:571](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:571); SHA-256 `e7bbb80c8a0675bb740d412b3d69df1cc73f3aad7ebdf5a850054cdd4cd700a4`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(reassign.getByLabel("Hours per week")).toHaveValue("8")
```

### apps/web/e2e/staff-workload.spec.ts:572:9

[apps/web/e2e/staff-workload.spec.ts:572](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:572); SHA-256 `b904aed0ac22cf4bbcc9b5d995779fe41ddb909199a980e76aeeb89f2a9eb8d6`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(reassign.getByLabel("End date")).toHaveValue("2026-11-09")
```

### apps/web/e2e/staff-workload.spec.ts:574:9

[apps/web/e2e/staff-workload.spec.ts:574](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:574); SHA-256 `d6476b0a67a8ddf5531ac5ff6de2655a6c9cc49cc19db868f4ab266fc0ba1939`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(page.getByRole("option", { name: /Maria Santos/ })).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:575:9

[apps/web/e2e/staff-workload.spec.ts:575](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:575); SHA-256 `634eadb1124fdad30bdd4dfabd8f88910fdf00498f96fd034aa18dceaf22af32`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(page.getByRole("option", { name: /Former Staff/ })).toHaveCount(
    0,
  )
```

### apps/web/e2e/staff-workload.spec.ts:588:9

[apps/web/e2e/staff-workload.spec.ts:588](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:588); SHA-256 `ee6ee62858161d5da41e0385fabdab20dd8f01872b5c80555cd6aeccde54da95`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(
    page.getByRole("heading", { name: "Unassign staff?", exact: true }),
  ).toBeVisible()
```

### apps/web/e2e/staff-workload.spec.ts:599:3

[apps/web/e2e/staff-workload.spec.ts:599](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:599); SHA-256 `a5dd4c68abd65fe0afae80f2a0e1cbb726bd59889785b781bbf189b0dcea6279`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(removed).toBe(true)
```

### apps/web/e2e/staff-workload.spec.ts:602:3

[apps/web/e2e/staff-workload.spec.ts:602](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:602); SHA-256 `1e6d4b7bf7cc4f3faee6ae0be29f9963252ee02683fd75aa0b5863a38688d26b`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(refreshedBody.projects[0].staff).toEqual([])
```

### apps/web/e2e/staff-workload.spec.ts:610:9

[apps/web/e2e/staff-workload.spec.ts:610](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:610); SHA-256 `f83f437089603ed032fbccff267a1af597cf195e8b521ab675979374e9f401ad`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(cleanedUp).not.toContainText("Former Staff")
```

### apps/web/e2e/staff-workload.spec.ts:611:9

[apps/web/e2e/staff-workload.spec.ts:611](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:611); SHA-256 `8eacc9cae41120728aecd35db93e244ffa6fdf61b508ceb418febf637db1c6f6`.

Direct callback owners: PW-268.

All possible owners, including helper/route/hook candidates: PW-268.

```ts
expect(
    cleanedUp.getByRole("button", { name: "Assign staff", exact: true }),
  ).toBeVisible()
```

## apps/web/e2e/staff.spec.ts

### apps/web/e2e/staff.spec.ts:19:13

[apps/web/e2e/staff.spec.ts:19](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:19); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/staff.spec.ts:20:13

[apps/web/e2e/staff.spec.ts:20](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:20); SHA-256 `79b448acebf94a9a1d456e155e429fb3f26f1242aa9b0b2e4721f2c41768d17a`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(page.locator(`[data-role="${role}"]`)).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:23:13

[apps/web/e2e/staff.spec.ts:23](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:23); SHA-256 `c63f8168818af82d81901830643e8eee0c540518b013caedd1ff6a5d31060037`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
        menu.getByRole("link", { name: "Account Management", exact: true }),
      ).toHaveCount(managesAccounts ? 1 : 0)
```

### apps/web/e2e/staff.spec.ts:26:13

[apps/web/e2e/staff.spec.ts:26](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:26); SHA-256 `566e7d314793f50d256ab31ac55237abfc9fd18c12003a47975385227ea58f29`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
        menu.getByRole("link", { name: "Department Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
```

### apps/web/e2e/staff.spec.ts:29:13

[apps/web/e2e/staff.spec.ts:29](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:29); SHA-256 `f21615bb5280e3e5e948437ac0c5dff7c1a1518fa72a07c7b9f8255badc5972d`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
        menu.getByRole("link", { name: "Employee Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
```

### apps/web/e2e/staff.spec.ts:32:13

[apps/web/e2e/staff.spec.ts:32](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:32); SHA-256 `da3d4a0971d26fdb0e15bbf66c3ef849bcf9064e76649d8f2a8ef068be6254d1`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
        menu.getByRole("link", { name: "Service Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
```

### apps/web/e2e/staff.spec.ts:35:13

[apps/web/e2e/staff.spec.ts:35](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:35); SHA-256 `9a5845e523f13a485a17cba01eb459ccfda76848196dc1d5d26ec706399f2b72`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
        menu.getByRole("link", { name: "Services", exact: true }),
      ).toHaveCount(role === "USER" ? 1 : 0)
```

### apps/web/e2e/staff.spec.ts:41:15

[apps/web/e2e/staff.spec.ts:41](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:41); SHA-256 `6aa3816745521dbc6f185a533ab5cdac847171dc9e2904eb0dd8490d67b1ce61`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Account Management" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:44:15

[apps/web/e2e/staff.spec.ts:44](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:44); SHA-256 `c215aed0db726ff3401f8d8c67013243bfd70381aa9e0dd8090bc6c1862b011e`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByText("Test Person", { exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:47:15

[apps/web/e2e/staff.spec.ts:47](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:47); SHA-256 `722218bacdb09ba3c09bb4cff9b940ab6eaafa7f38ff06d0f7e57516634ac6e1`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          menu.getByRole("link", { name: "Account Management", exact: true }),
        ).toHaveAttribute("aria-current", "page")
```

### apps/web/e2e/staff.spec.ts:51:15

[apps/web/e2e/staff.spec.ts:51](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:51); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/staff.spec.ts:62:15

[apps/web/e2e/staff.spec.ts:62](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:62); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/staff.spec.ts:63:15

[apps/web/e2e/staff.spec.ts:63](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:63); SHA-256 `323f40f6d0fdd0194ac30ea07cb6ba4208bdab96ba59bc1c2ec661e7058f8254`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Department Management" }),
        ).toHaveCount(0)
```

### apps/web/e2e/staff.spec.ts:66:9

[apps/web/e2e/staff.spec.ts:66](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:66); SHA-256 `6dac64363f760c877b5321da2445df0e8daa110287c9bb120bdb0d5569aa750b`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(departmentRequests).toEqual([])
```

### apps/web/e2e/staff.spec.ts:68:15

[apps/web/e2e/staff.spec.ts:68](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:68); SHA-256 `b90be7b84469219be8036f1bce640b3305b4e2761fc1c9bd9d1b28c7bc28cd94`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Department Management" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:71:15

[apps/web/e2e/staff.spec.ts:71](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:71); SHA-256 `10dc791b15c80dbadd133b4afba8abfc99b9d02554f02ca99b8b76e0d7a4030f`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("button", { name: "Create Department", exact: true }),
        ).toHaveCount(1)
```

### apps/web/e2e/staff.spec.ts:75:15

[apps/web/e2e/staff.spec.ts:75](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:75); SHA-256 `b90be7b84469219be8036f1bce640b3305b4e2761fc1c9bd9d1b28c7bc28cd94`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Department Management" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:88:15

[apps/web/e2e/staff.spec.ts:88](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:88); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/staff.spec.ts:89:15

[apps/web/e2e/staff.spec.ts:89](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:89); SHA-256 `f4ba640ca8c4aa7b3ff0b77bc6a6c94c78466338394ed1e33dd4fa86264a0bbf`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Employee Management" }),
        ).toHaveCount(0)
```

### apps/web/e2e/staff.spec.ts:92:9

[apps/web/e2e/staff.spec.ts:92](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:92); SHA-256 `180ca3b45fabaf58321685c8a8ec86ec756dbd8e05fe66965528d20139e8dfd8`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(employeeRequests).toEqual([])
```

### apps/web/e2e/staff.spec.ts:94:15

[apps/web/e2e/staff.spec.ts:94](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:94); SHA-256 `59c47d71a055f7da91e3974618c5ce689575b71af437304f996d7d1b73ddc4f3`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Employee Management" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:97:15

[apps/web/e2e/staff.spec.ts:97](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:97); SHA-256 `0429163c3106d91af54a2221ae719ead704e9fc06654eddd670f5e2a48dc2ebc`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByText("Alex Employee", { exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:100:15

[apps/web/e2e/staff.spec.ts:100](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:100); SHA-256 `00eb5242b867c23f15cb0ab8961f998b045d4c9bfc7e1c4f128cb905dc640593`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("button", { name: "Create Employee", exact: true }),
        ).toHaveCount(1)
```

### apps/web/e2e/staff.spec.ts:103:9

[apps/web/e2e/staff.spec.ts:103](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:103); SHA-256 `0bd5513ec8f618c84beb3bcd93dd8e6cc1dd34da5295ccb9c10a5bc9723e8584`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(employeeRequests).toHaveLength(1)
```

### apps/web/e2e/staff.spec.ts:118:15

[apps/web/e2e/staff.spec.ts:118](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:118); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/staff.spec.ts:119:15

[apps/web/e2e/staff.spec.ts:119](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:119); SHA-256 `492c5b8924bea49f136c8c3ec232c96dafb6185c65e178b5786715584d24cb97`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toHaveCount(0)
```

### apps/web/e2e/staff.spec.ts:122:9

[apps/web/e2e/staff.spec.ts:122](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:122); SHA-256 `847c093c5fb4d7d8e81282b340724921ac7231f19e1064ce89bf252575499af7`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(serviceRequests).toEqual([])
```

### apps/web/e2e/staff.spec.ts:124:15

[apps/web/e2e/staff.spec.ts:124](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:124); SHA-256 `4d8e42a14ef46824f98af3da9df3df080cfb8d615edd6f77a840859541dd92b4`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:127:15

[apps/web/e2e/staff.spec.ts:127](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:127); SHA-256 `975caad488707aeb48d91b45dcd44224ce5af604534efb6004c6b38527b1af3c`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByText("Test Service", { exact: true }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:130:15

[apps/web/e2e/staff.spec.ts:130](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:130); SHA-256 `d8e8c4334ba8000cfe7d6fa239fc39058b178588e54ffc640394d52f50536212`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("button", { name: "Create Service", exact: true }),
        ).toHaveCount(1)
```

### apps/web/e2e/staff.spec.ts:133:9

[apps/web/e2e/staff.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:133); SHA-256 `df59a8cb96f81684cac43008c311466630cb437726733a2a6dc26d0d36c01ff3`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          serviceRequests.map((url) => new URL(url).pathname).sort(),
        ).toEqual(["/api/services", "/api/services/pricing-templates"])
```

### apps/web/e2e/staff.spec.ts:137:15

[apps/web/e2e/staff.spec.ts:137](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:137); SHA-256 `4d8e42a14ef46824f98af3da9df3df080cfb8d615edd6f77a840859541dd92b4`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:141:15

[apps/web/e2e/staff.spec.ts:141](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:141); SHA-256 `07c12118590f1e25ba54e2dbd3b7cf5461565d00019f997fc9b6ec4d48f60652`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("heading", { name: "Build Your Brand with EXP" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:144:15

[apps/web/e2e/staff.spec.ts:144](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:144); SHA-256 `50d9d028fa5d414ef63e5bfe403ed32fced5b86995fefde80ae075e9d76606b2`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(
          page.getByRole("button", { name: "Explore Test Service" }),
        ).toBeVisible()
```

### apps/web/e2e/staff.spec.ts:147:9

[apps/web/e2e/staff.spec.ts:147](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:147); SHA-256 `39c498a46cafb930c0c822e9dcf23748c977958185310b8c9fcb0a5df350e092`.

Direct callback owners: PW-269, PW-270, PW-271, PW-272.

All possible owners, including helper/route/hook candidates: PW-269, PW-270, PW-271, PW-272.

```ts
expect(serviceRequests.map((url) => new URL(url).pathname)).toEqual([
          "/api/client/services",
        ])
```

## apps/web/e2e/superadmin.spec.ts

### apps/web/e2e/superadmin.spec.ts:20:11

[apps/web/e2e/superadmin.spec.ts:20](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:20); SHA-256 `283c17783b8400afa0240f5ab025efc9e719c4b5acdaf083c8ca29834e8fe6a8`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Your account", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:21:11

[apps/web/e2e/superadmin.spec.ts:21](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:21); SHA-256 `adf50c55179377c49c15c453fefcd57d9d0751d664474fd73be8d9c18fa5b2d3`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Target User", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:47:11

[apps/web/e2e/superadmin.spec.ts:47](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:47); SHA-256 `29e19bc7c0bf8ea0fab869d9a414cd63fd07d0982e30be3338c394563bd3a225`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Your account", { exact: true })).toHaveCount(
      0,
    )
```

### apps/web/e2e/superadmin.spec.ts:50:11

[apps/web/e2e/superadmin.spec.ts:50](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:50); SHA-256 `adf50c55179377c49c15c453fefcd57d9d0751d664474fd73be8d9c18fa5b2d3`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Target User", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:52:11

[apps/web/e2e/superadmin.spec.ts:52](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:52); SHA-256 `adf50c55179377c49c15c453fefcd57d9d0751d664474fd73be8d9c18fa5b2d3`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Target User", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:54:11

[apps/web/e2e/superadmin.spec.ts:54](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:54); SHA-256 `283c17783b8400afa0240f5ab025efc9e719c4b5acdaf083c8ca29834e8fe6a8`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Your account", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:56:11

[apps/web/e2e/superadmin.spec.ts:56](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:56); SHA-256 `90055f7e91574f7c27d405ae4d411027c834c4257b937596bfc8d2f6333f1b37`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(table.getByText("Target User", { exact: true })).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:57:11

[apps/web/e2e/superadmin.spec.ts:57](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:57); SHA-256 `1974b5515fa4edb73757159e34241e09ffa89285953b3b963a0558cbe3f8eb45`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(page.getByRole("status")).toContainText(
      "Searching all accounts",
    )
```

### apps/web/e2e/superadmin.spec.ts:60:11

[apps/web/e2e/superadmin.spec.ts:60](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:60); SHA-256 `27d5d2b48bd904d1158c9332709363370ee2d9cd8a20472f3390c0ffaa170207`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(
      table.getByText("No accounts match your search.", { exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:64:11

[apps/web/e2e/superadmin.spec.ts:64](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:64); SHA-256 `23ef80b565c944c230c274355bb27cdacc41e8aad1494caccc3ac5342682bef6`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(
      table.getByText("Remote Client", { exact: true }),
    ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:67:11

[apps/web/e2e/superadmin.spec.ts:67](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:67); SHA-256 `7f6746809808d6ff87174f65a421a1d6112f44979a98e18a56ef556e0568968f`.

Direct callback owners: PW-273.

All possible owners, including helper/route/hook candidates: PW-273.

```ts
expect(
      page.getByText("Searching all accounts…", { exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:85:9

[apps/web/e2e/superadmin.spec.ts:85](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:85); SHA-256 `4ecfe00535b0388344dbdc86bf686b46bfb7336d5b1555ce4d52ef84274ed6df`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(request.method()).toBe("POST")
```

### apps/web/e2e/superadmin.spec.ts:86:9

[apps/web/e2e/superadmin.spec.ts:86](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:86); SHA-256 `169370ba1b07ac39824c84e67c2a2f8a05e3f286b3c60d136b8dc9751790605e`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(request.headers().authorization).toBe("Bearer test-session")
```

### apps/web/e2e/superadmin.spec.ts:87:9

[apps/web/e2e/superadmin.spec.ts:87](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:87); SHA-256 `eaf009cd65fc2499be0273b46facac75dc93401891210e45af68e53ef5e0053b`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(request.postDataJSON()).toEqual({
          newPassword: " MyNewPassword123! ",
        })
```

### apps/web/e2e/superadmin.spec.ts:102:13

[apps/web/e2e/superadmin.spec.ts:102](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:102); SHA-256 `1111c57871e4fcc778686cf16464c8d15a89425556969d69e810dc4472adb42c`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        page.getByRole("button", { name: "Change my password", exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:125:13

[apps/web/e2e/superadmin.spec.ts:125](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:125); SHA-256 `2c16ce270d061781a7b5905861fc357b1a79ab7b8c6bc2dd214ca3c609cea131`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(dialog).toContainText("target@example.com")
```

### apps/web/e2e/superadmin.spec.ts:126:13

[apps/web/e2e/superadmin.spec.ts:126](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:126); SHA-256 `e1aba66835cd069d8978462729aad7f024703db4bd2d3eb76c76d35ae786e5a2`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        dialog.getByLabel("Current password", { exact: true }),
      ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:131:13

[apps/web/e2e/superadmin.spec.ts:131](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:131); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:133:13

[apps/web/e2e/superadmin.spec.ts:133](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:133); SHA-256 `36cf682c26c03bfcb9000d7f9dab33e316e6f755cd9a828105180ff4c8e91fc0`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(next).toHaveValue("")
```

### apps/web/e2e/superadmin.spec.ts:135:13

[apps/web/e2e/superadmin.spec.ts:135](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:135); SHA-256 `ed2e2ca015c752bff2951b2f84244115f0036a7c4a8d8aa13d84bbbed6ec2164`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(next).toBeFocused()
```

### apps/web/e2e/superadmin.spec.ts:136:13

[apps/web/e2e/superadmin.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:136); SHA-256 `94e8361ff782ac7696cc7b7c078b0c7088a5e671524acf2619b8a0d98039c825`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        dialog.getByText("Use at least 12 characters."),
      ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:142:13

[apps/web/e2e/superadmin.spec.ts:142](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:142); SHA-256 `c958bda9094ea4a8c0e65afae19433f66da09a991fcbb4b7c20b4ae195e7bac9`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        dialog.getByText("Use no more than 1,024 bytes."),
      ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:148:13

[apps/web/e2e/superadmin.spec.ts:148](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:148); SHA-256 `17f5c451ff7b9ed7c2a7299d3f1271cb19b602b7068e68532fc651c3ea259cba`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(dialog.getByText("Passwords do not match.")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:149:7

[apps/web/e2e/superadmin.spec.ts:149](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:149); SHA-256 `18263c85e65de6c2eded6cf5a4ad3263f323f421621e9660d13c48a250ee7f54`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(attempts).toBe(0)
```

### apps/web/e2e/superadmin.spec.ts:154:13

[apps/web/e2e/superadmin.spec.ts:154](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:154); SHA-256 `9a2025edef34caa70d40b144f53f3b29af04e4eada775efd5216dde00f8fc720`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(next).toHaveAttribute("type", "text")
```

### apps/web/e2e/superadmin.spec.ts:158:13

[apps/web/e2e/superadmin.spec.ts:158](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:158); SHA-256 `5db3f5fe2756e7647fdd4d5382dfa49dd55c9e44e7709779866878337c95006b`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(next).toHaveAttribute("type", "password")
```

### apps/web/e2e/superadmin.spec.ts:160:13

[apps/web/e2e/superadmin.spec.ts:160](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:160); SHA-256 `05043e4c3ea223e394308ba587dbcd77706466c6f7aab4ea5e7b70748850fd68`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(dialog.getByRole("alert")).toHaveText(
        "Unable to change password. Please retry.",
      )
```

### apps/web/e2e/superadmin.spec.ts:163:13

[apps/web/e2e/superadmin.spec.ts:163](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:163); SHA-256 `eff041a16088e035351b5378276d7c584f19b9741fd1102d4410cb66896c1f82`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(page).toHaveURL(/\/accounts$/)
```

### apps/web/e2e/superadmin.spec.ts:164:7

[apps/web/e2e/superadmin.spec.ts:164](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:164); SHA-256 `5d9b14ea666f961a957fe445b4a53de49403f1890a6f3ed5b6863366c9346468`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("test-session")
```

### apps/web/e2e/superadmin.spec.ts:172:13

[apps/web/e2e/superadmin.spec.ts:172](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:172); SHA-256 `ef79f9cc40d2df22745ade3a24310c47aed38bfdfade46dbe9dd9dac7e2f0254`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(pending).toBeDisabled()
```

### apps/web/e2e/superadmin.spec.ts:173:13

[apps/web/e2e/superadmin.spec.ts:173](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:173); SHA-256 `df5cb083d92f34c21dd8fd79d5a3dad65d80ee6627435ba5cf0b9f74738ebbb0`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(next).toBeDisabled()
```

### apps/web/e2e/superadmin.spec.ts:174:13

[apps/web/e2e/superadmin.spec.ts:174](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:174); SHA-256 `44399acbbd01f4b7ca6c9cd420071b9b1aef02908b807bea687b00ea843030d4`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/superadmin.spec.ts:178:13

[apps/web/e2e/superadmin.spec.ts:178](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:178); SHA-256 `503826a2018dc807717e939e1ac449de012a3f07e79519957b561495bef07519`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(dialog).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:179:7

[apps/web/e2e/superadmin.spec.ts:179](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:179); SHA-256 `8f1348f7e80e8c0a908041fb47803d79a6a05c91d810e5240cf31aea708ae1cd`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(attempts).toBe(2)
```

### apps/web/e2e/superadmin.spec.ts:181:7

[apps/web/e2e/superadmin.spec.ts:181](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:181); SHA-256 `61f9fc1a270624ec68047d4dabb7f2ea9f09ba0725a9bc0fcbb0833e1538892a`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(box).not.toBeNull()
```

### apps/web/e2e/superadmin.spec.ts:182:7

[apps/web/e2e/superadmin.spec.ts:182](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:182); SHA-256 `59b36796698fdefacc027af9252b517d7a30a2e8cd8f342118bee7a142adf7c8`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(box!.x).toBeGreaterThanOrEqual(0)
```

### apps/web/e2e/superadmin.spec.ts:183:7

[apps/web/e2e/superadmin.spec.ts:183](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:183); SHA-256 `f2566f674733109d2a138b3f6e4924077e663414a99146f5a59208509d7a8ac9`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(box!.x + box!.width).toBeLessThanOrEqual(width)
```

### apps/web/e2e/superadmin.spec.ts:185:13

[apps/web/e2e/superadmin.spec.ts:185](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:185); SHA-256 `339c17bef9f65496153b63426dc6ad06090ca91c7abb309290031872122cec1c`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(dialog).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:186:13

[apps/web/e2e/superadmin.spec.ts:186](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:186); SHA-256 `eff041a16088e035351b5378276d7c584f19b9741fd1102d4410cb66896c1f82`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(page).toHaveURL(/\/accounts$/)
```

### apps/web/e2e/superadmin.spec.ts:187:7

[apps/web/e2e/superadmin.spec.ts:187](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:187); SHA-256 `5d9b14ea666f961a957fe445b4a53de49403f1890a6f3ed5b6863366c9346468`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("test-session")
```

### apps/web/e2e/superadmin.spec.ts:190:13

[apps/web/e2e/superadmin.spec.ts:190](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:190); SHA-256 `02d7df2d0a666c3a2912fa2f5ed42cf9d6773a2930f4e98d1cf0e4cd0cc358bc`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(
        page.getByText("Password changed", { exact: true }),
      ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:193:7

[apps/web/e2e/superadmin.spec.ts:193](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:193); SHA-256 `8f1348f7e80e8c0a908041fb47803d79a6a05c91d810e5240cf31aea708ae1cd`.

Direct callback owners: PW-274, PW-275.

All possible owners, including helper/route/hook candidates: PW-274, PW-275.

```ts
expect(attempts).toBe(2)
```

### apps/web/e2e/superadmin.spec.ts:202:11

[apps/web/e2e/superadmin.spec.ts:202](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:202); SHA-256 `bac6c33a8e494c7866ba1d8753caae493f7f4de35cf160a19a00d9405afba451`.

Direct callback owners: PW-276.

All possible owners, including helper/route/hook candidates: PW-276.

```ts
expect(page.getByText("Your account", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:203:11

[apps/web/e2e/superadmin.spec.ts:203](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:203); SHA-256 `e6fb42b16f5e5a6f0fc236462ece118c4004d3e9c31d8882f0720fb133717306`.

Direct callback owners: PW-276.

All possible owners, including helper/route/hook candidates: PW-276.

```ts
expect(
      page.getByRole("button", { name: /Role for testsuperadmin@nexus.com/ }),
    ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:206:11

[apps/web/e2e/superadmin.spec.ts:206](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:206); SHA-256 `ad43aae561098f066364ccd05856bdd900c000cf59e66a32e63233c2e15e06cb`.

Direct callback owners: PW-276.

All possible owners, including helper/route/hook candidates: PW-276.

```ts
expect(
      page.getByRole("button", {
        name: "More actions for testsuperadmin@nexus.com",
      }),
    ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:214:11

[apps/web/e2e/superadmin.spec.ts:214](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:214); SHA-256 `abfc84963369eb645f836a53abfd28f44f86c0dc0a586ef873017643d96feb12`.

Direct callback owners: PW-276.

All possible owners, including helper/route/hook candidates: PW-276.

```ts
expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toHaveCount(0)
```

### apps/web/e2e/superadmin.spec.ts:225:11

[apps/web/e2e/superadmin.spec.ts:225](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:225); SHA-256 `e804a9edb2a68e3de9d8dd7ffe23ba4a03b62bb66a54064c08b24ce00e59d3fa`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(
      page.getByRole("heading", { name: "Account Management" }),
    ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:228:11

[apps/web/e2e/superadmin.spec.ts:228](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:228); SHA-256 `1d1acc4168180067f543b0d57670f976f377cfe60c737ad541c0aff7a0cfba54`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(page.getByText("Target User")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:233:11

[apps/web/e2e/superadmin.spec.ts:233](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:233); SHA-256 `622029429c01d7fe58abf8cd3e0760be9410e1e7c812c735c5c2db0253d17406`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(
      page.getByRole("row").filter({ hasText: "target@example.com" }),
    ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:245:11

[apps/web/e2e/superadmin.spec.ts:245](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:245); SHA-256 `5019b2cc8107ad03295aacb17a7717d46872b0052b202dbbecc9fc1992809ed8`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(saveButton).toBeEnabled()
```

### apps/web/e2e/superadmin.spec.ts:247:11

[apps/web/e2e/superadmin.spec.ts:247](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:247); SHA-256 `4d569c65ff898a8e3cbe8a1a66789cf29ddc9cf8b12f2e92d7358fc8b8a4f841`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(
      page.getByRole("button", { name: "Role for target@example.com: Staff" }),
    ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:259:11

[apps/web/e2e/superadmin.spec.ts:259](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:259); SHA-256 `5ab50f3f6c1d05c0f6867680ed569c617f77784fa589dadc19e6a7f51cc08e44`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(page.getByText("Deactivate account?")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:265:11

[apps/web/e2e/superadmin.spec.ts:265](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:265); SHA-256 `964bd521460c5b68105151407594230a79a1a23705b558a3ea1fc8ea102ed623`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(page.getByText("Inactive")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:270:11

[apps/web/e2e/superadmin.spec.ts:270](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:270); SHA-256 `c3dd959330d357f531c78aa9a429e7b158caa172c83d61f5caa97c7fa0947f5b`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(page.getByText("Reactivate account?")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:276:11

[apps/web/e2e/superadmin.spec.ts:276](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:276); SHA-256 `4ea9d700058fad12f1e2ffdf96327c3454843e7a164fc28fb80ac6d320c18793`.

Direct callback owners: PW-277.

All possible owners, including helper/route/hook candidates: PW-277.

```ts
expect(page.getByText("Active").first()).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:300:9

[apps/web/e2e/superadmin.spec.ts:300](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:300); SHA-256 `74bfa794e844667d7212cf2020190fd2065e1374f9634c80689d92a7e75e460a`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(route.request().method()).toBe("POST")
```

### apps/web/e2e/superadmin.spec.ts:301:9

[apps/web/e2e/superadmin.spec.ts:301](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:301); SHA-256 `91f518592c25987b81b529ab60dbda3d5d1564df27c05e83181509d3d4f93b97`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(route.request().headers().authorization).toBe(
          "Bearer test-session",
        )
```

### apps/web/e2e/superadmin.spec.ts:317:13

[apps/web/e2e/superadmin.spec.ts:317](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:317); SHA-256 `6d0328051f70b7d424e83a89e6dc430c8d3f7e142174e705848a318ce273057c`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(page.getByText("Target User")).toBeHidden()
```

### apps/web/e2e/superadmin.spec.ts:319:13

[apps/web/e2e/superadmin.spec.ts:319](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:319); SHA-256 `1d1acc4168180067f543b0d57670f976f377cfe60c737ad541c0aff7a0cfba54`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(page.getByText("Target User")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:330:13

[apps/web/e2e/superadmin.spec.ts:330](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:330); SHA-256 `1e5fbd08a0355c6608851884d335f6af3a337929f563ab74ba19f6d30b935c06`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(
        dialog.getByRole("heading", { name: "Restore account?" }),
      ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:333:13

[apps/web/e2e/superadmin.spec.ts:333](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:333); SHA-256 `b98d4e1e5189ba51e4a8936d65553982d6db0191e228ef0458918a3f27451732`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(dialog).toContainText("as inactive")
```

### apps/web/e2e/superadmin.spec.ts:335:7

[apps/web/e2e/superadmin.spec.ts:335](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:335); SHA-256 `18263c85e65de6c2eded6cf5a4ad3263f323f421621e9660d13c48a250ee7f54`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(attempts).toBe(0)
```

### apps/web/e2e/superadmin.spec.ts:340:13

[apps/web/e2e/superadmin.spec.ts:340](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:340); SHA-256 `f553b3206e7bd5ad8c012a1abd9d8bc57e19a0e7f393987b46a4cae5ac4b580d`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(dialog.getByRole("alert")).toHaveText(
        "Restore failed. Please retry.",
      )
```

### apps/web/e2e/superadmin.spec.ts:346:13

[apps/web/e2e/superadmin.spec.ts:346](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:346); SHA-256 `780c968176960a476bd04539d2125b202c7e7fc21486f27fcf5e6f96da947868`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(
        dialog.getByRole("button", { name: "Restoring...", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/superadmin.spec.ts:349:13

[apps/web/e2e/superadmin.spec.ts:349](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:349); SHA-256 `44399acbbd01f4b7ca6c9cd420071b9b1aef02908b807bea687b00ea843030d4`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeDisabled()
```

### apps/web/e2e/superadmin.spec.ts:353:13

[apps/web/e2e/superadmin.spec.ts:353](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:353); SHA-256 `503826a2018dc807717e939e1ac449de012a3f07e79519957b561495bef07519`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(dialog).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:354:13

[apps/web/e2e/superadmin.spec.ts:354](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:354); SHA-256 `81ece583c3394779481c43e778b75df73adcbced3e118f81c1ab74f5976b27e1`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect.poll(() => Boolean(releaseRestore)).toBe(true)
```

### apps/web/e2e/superadmin.spec.ts:356:13

[apps/web/e2e/superadmin.spec.ts:356](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:356); SHA-256 `c2efebbc485a6cdc94bbafa929c4a09187dfe92943387823b98be3f022b5b1db`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(dialog).toBeHidden()
```

### apps/web/e2e/superadmin.spec.ts:357:13

[apps/web/e2e/superadmin.spec.ts:357](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:357); SHA-256 `6d0328051f70b7d424e83a89e6dc430c8d3f7e142174e705848a318ce273057c`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(page.getByText("Target User")).toBeHidden()
```

### apps/web/e2e/superadmin.spec.ts:361:13

[apps/web/e2e/superadmin.spec.ts:361](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:361); SHA-256 `1d1acc4168180067f543b0d57670f976f377cfe60c737ad541c0aff7a0cfba54`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(page.getByText("Target User")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:362:13

[apps/web/e2e/superadmin.spec.ts:362](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:362); SHA-256 `1a8f823a940b407f9fcc0eacb5a8f6a90ed661c0c2cd9338e3b1c107620ccddd`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(page.getByText("Inactive", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:366:13

[apps/web/e2e/superadmin.spec.ts:366](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:366); SHA-256 `0d09921afb8fb580f67c987b8f316b3fbdc97d372b2f0f589862a1b5207ebdb8`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(
        page.getByRole("menuitem", { name: "Restore account", exact: true }),
      ).toBeHidden()
```

### apps/web/e2e/superadmin.spec.ts:376:13

[apps/web/e2e/superadmin.spec.ts:376](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:376); SHA-256 `401cf976a898eb103dfeaf6ce853dea53efd93705bd5e29adce61c82fe657b54`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(page.getByText("Active", { exact: true })).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:377:7

[apps/web/e2e/superadmin.spec.ts:377](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:377); SHA-256 `8f1348f7e80e8c0a908041fb47803d79a6a05c91d810e5240cf31aea708ae1cd`.

Direct callback owners: PW-278, PW-279.

All possible owners, including helper/route/hook candidates: PW-278, PW-279.

```ts
expect(attempts).toBe(2)
```

### apps/web/e2e/superadmin.spec.ts:402:11

[apps/web/e2e/superadmin.spec.ts:402](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:402); SHA-256 `3c02a53c68ef63082922ecfda3b849d806aa07d98b139faf2fc1d4d3b7a0a81f`.

Direct callback owners: PW-280.

All possible owners, including helper/route/hook candidates: PW-280.

```ts
expect(page.getByText("Move account to Trash?")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:404:11

[apps/web/e2e/superadmin.spec.ts:404](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:404); SHA-256 `6d0328051f70b7d424e83a89e6dc430c8d3f7e142174e705848a318ce273057c`.

Direct callback owners: PW-280.

All possible owners, including helper/route/hook candidates: PW-280.

```ts
expect(page.getByText("Target User")).toBeHidden()
```

### apps/web/e2e/superadmin.spec.ts:407:11

[apps/web/e2e/superadmin.spec.ts:407](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:407); SHA-256 `1d1acc4168180067f543b0d57670f976f377cfe60c737ad541c0aff7a0cfba54`.

Direct callback owners: PW-280.

All possible owners, including helper/route/hook candidates: PW-280.

```ts
expect(page.getByText("Target User")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:408:11

[apps/web/e2e/superadmin.spec.ts:408](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:408); SHA-256 `b2680e4d2145796d418e6b385892ba83ab4b8576bbd091018cc50cd078d2deb5`.

Direct callback owners: PW-280.

All possible owners, including helper/route/hook candidates: PW-280.

```ts
expect(
      page
        .getByText("Deleted", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:419:11

[apps/web/e2e/superadmin.spec.ts:419](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:419); SHA-256 `259132fea78168da61e55762894e39affeb67c40bd2a5e572817d6979bcd9149`.

Direct callback owners: PW-280.

All possible owners, including helper/route/hook candidates: PW-280.

```ts
expect(page.getByText("Permanently delete account?")).toBeVisible()
```

### apps/web/e2e/superadmin.spec.ts:421:11

[apps/web/e2e/superadmin.spec.ts:421](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:421); SHA-256 `6d0328051f70b7d424e83a89e6dc430c8d3f7e142174e705848a318ce273057c`.

Direct callback owners: PW-280.

All possible owners, including helper/route/hook candidates: PW-280.

```ts
expect(page.getByText("Target User")).toBeHidden()
```

## apps/web/e2e/table-interactions.spec.ts

### apps/web/e2e/table-interactions.spec.ts:136:11

[apps/web/e2e/table-interactions.spec.ts:136](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:136); SHA-256 `5f3cc75bff7b3dc965f78d491bde64ec3fee7156b43dd83d6e096e737e332475`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(submenuToggle).toHaveAttribute("aria-expanded", "true")
```

### apps/web/e2e/table-interactions.spec.ts:138:11

[apps/web/e2e/table-interactions.spec.ts:138](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:138); SHA-256 `9a97aa951a76a7d7943227628189810921b0e143ca95832c0f46dc2e477c3686`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(submenuToggle).toHaveAttribute("aria-expanded", "false")
```

### apps/web/e2e/table-interactions.spec.ts:139:11

[apps/web/e2e/table-interactions.spec.ts:139](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:139); SHA-256 `d89499f4ea29d8ecd13ccb5cfda3e333e98a54eee7690bc6c6bdbc563be99e81`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(page).toHaveURL(/\/dashboard$/)
```

### apps/web/e2e/table-interactions.spec.ts:143:11

[apps/web/e2e/table-interactions.spec.ts:143](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:143); SHA-256 `b0f0665e651570efca8ca15018436b4dd11b888296001184250560563211ceb7`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(page).toHaveURL(/\/project-workspace$/)
```

### apps/web/e2e/table-interactions.spec.ts:144:11

[apps/web/e2e/table-interactions.spec.ts:144](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:144); SHA-256 `5efb8b344ee84f1fd9339b5c59ee8460188d804566175a5768e88821afe3d46d`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(
      page.getByRole("region", { name: "Project list" }).getByRole("table"),
    ).toBeVisible()
```

### apps/web/e2e/table-interactions.spec.ts:148:13

[apps/web/e2e/table-interactions.spec.ts:148](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:148); SHA-256 `0405d896647a3842802556c8508ca0e27d680f1a7ac9f82825604b2738a3d586`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(page.getByLabel("Primary navigation")).toHaveAttribute(
        "data-drawer-open",
        "false",
      )
```

### apps/web/e2e/table-interactions.spec.ts:155:11

[apps/web/e2e/table-interactions.spec.ts:155](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:155); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:162:11

[apps/web/e2e/table-interactions.spec.ts:162](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:162); SHA-256 `4edefefff7c8385b4360b89c40306730becf724722fd6cd6737d88ed5ae4b03a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(0)
```

### apps/web/e2e/table-interactions.spec.ts:169:11

[apps/web/e2e/table-interactions.spec.ts:169](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:169); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:171:11

[apps/web/e2e/table-interactions.spec.ts:171](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:171); SHA-256 `4edefefff7c8385b4360b89c40306730becf724722fd6cd6737d88ed5ae4b03a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(0)
```

### apps/web/e2e/table-interactions.spec.ts:172:11

[apps/web/e2e/table-interactions.spec.ts:172](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:172); SHA-256 `e4fdd44688f8cc1bc33ff9770536803e6a3852bbdf2c0b2b6099307dfaea7b8f`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(
      page.getByRole("button", { name: "Filter by project status:" }),
    ).toContainText("All archived")
```

### apps/web/e2e/table-interactions.spec.ts:178:11

[apps/web/e2e/table-interactions.spec.ts:178](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:178); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:183:11

[apps/web/e2e/table-interactions.spec.ts:183](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:183); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:184:5

[apps/web/e2e/table-interactions.spec.ts:184](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:184); SHA-256 `a179b5ca56f05c66c38c6ca635ceccfef7781b3bdf01c153877fc4e80a1f0357`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
```

### apps/web/e2e/table-interactions.spec.ts:191:11

[apps/web/e2e/table-interactions.spec.ts:191](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:191); SHA-256 `7e1c613d9c42b3fbcad8aab2cdf335b9cda7a028897fa820812d7f89d1607fe5`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(1)
```

### apps/web/e2e/table-interactions.spec.ts:192:11

[apps/web/e2e/table-interactions.spec.ts:192](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:192); SHA-256 `3a6c930254bd127ae3a5cda9e98d64a1884ee8207c157d8e1462b932a6734b2a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toContainText("Beta Project")
```

### apps/web/e2e/table-interactions.spec.ts:194:11

[apps/web/e2e/table-interactions.spec.ts:194](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:194); SHA-256 `4edefefff7c8385b4360b89c40306730becf724722fd6cd6737d88ed5ae4b03a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(0)
```

### apps/web/e2e/table-interactions.spec.ts:196:11

[apps/web/e2e/table-interactions.spec.ts:196](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:196); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:202:11

[apps/web/e2e/table-interactions.spec.ts:202](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:202); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:203:11

[apps/web/e2e/table-interactions.spec.ts:203](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:203); SHA-256 `01e960725b0e0e13d7fb450f616709377d003b436dc5a0084e9cacd5460b6ad9`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows.first()).toContainText("Alpha Task")
```

### apps/web/e2e/table-interactions.spec.ts:205:11

[apps/web/e2e/table-interactions.spec.ts:205](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:205); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:210:11

[apps/web/e2e/table-interactions.spec.ts:210](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:210); SHA-256 `7e1c613d9c42b3fbcad8aab2cdf335b9cda7a028897fa820812d7f89d1607fe5`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(1)
```

### apps/web/e2e/table-interactions.spec.ts:211:11

[apps/web/e2e/table-interactions.spec.ts:211](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:211); SHA-256 `9d68ac0c0bdd48613af9bb19d8233b455aeff91b9ed1cb111e55b46850fc1c85`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toContainText("Beta Staff")
```

### apps/web/e2e/table-interactions.spec.ts:213:11

[apps/web/e2e/table-interactions.spec.ts:213](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:213); SHA-256 `4edefefff7c8385b4360b89c40306730becf724722fd6cd6737d88ed5ae4b03a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(0)
```

### apps/web/e2e/table-interactions.spec.ts:215:11

[apps/web/e2e/table-interactions.spec.ts:215](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:215); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:222:11

[apps/web/e2e/table-interactions.spec.ts:222](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:222); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:224:11

[apps/web/e2e/table-interactions.spec.ts:224](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:224); SHA-256 `7e1c613d9c42b3fbcad8aab2cdf335b9cda7a028897fa820812d7f89d1607fe5`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(1)
```

### apps/web/e2e/table-interactions.spec.ts:225:11

[apps/web/e2e/table-interactions.spec.ts:225](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:225); SHA-256 `98cc05892642f2164444ca78c426c73a33dd8446fab9595886e0a018a4392e61`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toContainText("Beta Deliverable")
```

### apps/web/e2e/table-interactions.spec.ts:227:11

[apps/web/e2e/table-interactions.spec.ts:227](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:227); SHA-256 `4edefefff7c8385b4360b89c40306730becf724722fd6cd6737d88ed5ae4b03a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(0)
```

### apps/web/e2e/table-interactions.spec.ts:229:11

[apps/web/e2e/table-interactions.spec.ts:229](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:229); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-281, PW-282.

All possible owners, including helper/route/hook candidates: PW-281, PW-282.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:327:13

[apps/web/e2e/table-interactions.spec.ts:327](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:327); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:335:15

[apps/web/e2e/table-interactions.spec.ts:335](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:335); SHA-256 `7e1c613d9c42b3fbcad8aab2cdf335b9cda7a028897fa820812d7f89d1607fe5`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toHaveCount(1)
```

### apps/web/e2e/table-interactions.spec.ts:336:15

[apps/web/e2e/table-interactions.spec.ts:336](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:336); SHA-256 `64bac042710e3992a8a8208043d01647ada1ceac0840752fe040804b58eefe22`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toContainText("Alpha Table")
```

### apps/web/e2e/table-interactions.spec.ts:338:15

[apps/web/e2e/table-interactions.spec.ts:338](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:338); SHA-256 `04ab6c076aa5ab66367b8a6ee64d766f02d04b8d9b16e3a146a89ac9ab79bd7a`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toHaveCount(2)
```

### apps/web/e2e/table-interactions.spec.ts:341:15

[apps/web/e2e/table-interactions.spec.ts:341](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:341); SHA-256 `7e1c613d9c42b3fbcad8aab2cdf335b9cda7a028897fa820812d7f89d1607fe5`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toHaveCount(1)
```

### apps/web/e2e/table-interactions.spec.ts:342:15

[apps/web/e2e/table-interactions.spec.ts:342](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:342); SHA-256 `f0d190a1c6ac8b08b351cdc4e216eb8480b992441d05316e49fd1314e068420a`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toContainText("Beta Table")
```

### apps/web/e2e/table-interactions.spec.ts:344:15

[apps/web/e2e/table-interactions.spec.ts:344](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:344); SHA-256 `4edefefff7c8385b4360b89c40306730becf724722fd6cd6737d88ed5ae4b03a`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toHaveCount(0)
```

### apps/web/e2e/table-interactions.spec.ts:345:15

[apps/web/e2e/table-interactions.spec.ts:345](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:345); SHA-256 `6aa4b947138400715ce46c6a9cef6588a571322661253e5926c5a6603cc26da9`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(page.getByText(/^Searching all/)).toBeVisible()
```

### apps/web/e2e/table-interactions.spec.ts:347:15

[apps/web/e2e/table-interactions.spec.ts:347](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:347); SHA-256 `7e1c613d9c42b3fbcad8aab2cdf335b9cda7a028897fa820812d7f89d1607fe5`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toHaveCount(1)
```

### apps/web/e2e/table-interactions.spec.ts:348:15

[apps/web/e2e/table-interactions.spec.ts:348](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:348); SHA-256 `03eacb58ec482afc75d80a47a7919f69da658a6c0deda449a037193223890ae2`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(rows).toContainText("Remote Table")
```

### apps/web/e2e/table-interactions.spec.ts:349:15

[apps/web/e2e/table-interactions.spec.ts:349](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:349); SHA-256 `a5b387dc42fcbf954095aa3938bf1d5fe21e0a9035c2271fbb2e1aa38173db7a`.

Direct callback owners: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

All possible owners, including helper/route/hook candidates: PW-283, PW-284, PW-285, PW-286, PW-287, PW-288, PW-289, PW-290, PW-291, PW-292.

```ts
expect(page.getByText(/^Searching all/)).toHaveCount(0)
```
