/**
 * Inline validation message inside the popover. Rendered as `role="alert"`
 * so failed commits are announced; associate inputs via `aria-describedby`
 * pointing at `id`. Renders nothing while there is no error.
 */
export function PopoverValidationError({
  error,
  id,
}: {
  error: string | null;
  id?: string;
}) {
  if (!error) return null;
  return (
    <div id={id} role="alert" className="filter-popover-error">
      {error}
    </div>
  );
}
