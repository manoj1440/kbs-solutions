globalThis.kbsAdminLayoutSmoke = async (page) => {
  const origin = await page.evaluate(() => location.origin);
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const results = [];
  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/admin/leads', '/admin/calling-list']) {
      await page.goto(`${origin}${path}`);
      await page.locator('h1').waitFor();
      check(
        page.url() === `${origin}${path}`,
        'Sign in as Admin before running layout smoke tests.',
      );
      const tables = await page
        .locator('[data-slot="table-container"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({ width: node.clientWidth, content: node.scrollWidth })),
        );
      check(tables.length > 0, `Missing tables: ${path}`);
      check(
        tables.every((table) => table.content <= table.width + 1),
        `Table content clipped at ${width}px: ${path}`,
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `Page overflow at ${width}px: ${path}`,
      );
      const actions = page
        .locator('main')
        .getByRole(path.endsWith('/leads') ? 'link' : 'button', {
          name: path.endsWith('/leads') ? 'Open lead' : 'Reassign',
          exact: true,
        });
      check(
        (await actions.count()) > 0,
        'Seed at least one lead and active calling record before testing.',
      );
      const actionsFit = await actions.evaluateAll((nodes) =>
        nodes.every((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth;
        }),
      );
      check(actionsFit, `Actions off-screen at ${width}px: ${path}`);
      results.push({ width, path, tablesFit: true, actionsFit });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/admin/leads`);
  await page.getByRole('button', { name: 'More detail', exact: true }).first().click();
  const details = page.locator('tr[id^="lead-details-"]').first();
  for (const label of [
    'Bank Application No.',
    'Bank Application Reference',
    'KBS lead created',
    'CURRENT_STAGE (raw)',
    'FINAL_DECISION (raw)',
    'Card Activation Staus (raw)',
  ]) {
    check(
      await details.getByText(label, { exact: true }).isVisible(),
      `Missing expanded field: ${label}`,
    );
  }
  await page.getByRole('button', { name: 'Bank decision', exact: true }).click();
  check(await details.isVisible(), 'Sorting lost expanded details.');
  await page.getByRole('button', { name: 'Full table view', exact: true }).click();
  check((await page.locator('table thead th').count()) === 13, 'Full table lost required fields.');
  check(
    (await details.locator('td').getAttribute('colspan')) === '13',
    'Expanded detail column span is wrong.',
  );
  await page.getByRole('button', { name: 'Overview layout', exact: true }).click();
  check((await page.locator('table thead th').count()) === 6, 'Overview not restored.');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${origin}/admin/calling-list`);
    const trigger = page.getByRole('button', { name: 'Reassign', exact: true }).first();
    const table = page.locator('[data-slot="table-container"]').last();
    const before = await table.evaluate((node) => node.scrollWidth);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Reassign calling record', exact: true });
    check(
      await dialog.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return (
          bounds.left >= 0 && bounds.right <= innerWidth && node.scrollWidth <= node.clientWidth
        );
      }),
      `Reassignment dialog clipped at ${width}px.`,
    );
    check(
      await dialog.getByRole('button', { name: 'Move record' }).isDisabled(),
      'Reassignment allowed without a target and reason.',
    );
    check(
      before === (await table.evaluate((node) => node.scrollWidth)),
      'Opening reassignment stretched the table.',
    );
    await page.keyboard.press('Escape');
    check(
      await trigger.evaluate((node) => node === document.activeElement),
      'Dialog did not restore focus.',
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/admin/leads`);
  return {
    layouts: results,
    detailsAndFullTable: 'passed',
    reassignmentDialog: 'passed; no mutations submitted',
  };
}
