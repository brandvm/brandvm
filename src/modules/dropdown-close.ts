export function initDropdownClose() {
  const $ = window.jQuery;
  if (!$) return;
  $(document).on('click', '.js-close-dropdown', function (this: HTMLElement) {
    const dropdown = $(this).closest('.w-dropdown');
    if (!dropdown.length) return;
    dropdown.trigger('w-close');
    dropdown.children('.w-dropdown-toggle').trigger('blur');
  });
}
