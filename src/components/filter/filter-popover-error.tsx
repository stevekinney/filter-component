/**
 * Announces a validation error and links it to the active editor through
 * aria-describedby.
 */
export function PopoverValidationError({ error, id }: { error: string | null; id?: string }) {
  if (!error) return null;
  return (
    <div id={id} role="alert" className="filter-popover-error">
      {error}
    </div>
  );
}
