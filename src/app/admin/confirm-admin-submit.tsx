"use client";

import type { MouseEvent, ReactNode } from "react";

export function ConfirmAdminSubmit({
  children,
  className,
  confirmField,
  confirmValue,
  confirmUncheckedField,
  message,
  name,
  value,
}: {
  children: ReactNode;
  className: string;
  confirmField?: string;
  confirmValue?: string;
  confirmUncheckedField?: string;
  message: string;
  name?: string;
  value?: string;
}) {
  function confirm(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const data = form ? new FormData(form) : null;
    const shouldConfirm = !confirmField && !confirmUncheckedField ||
      Boolean(data && confirmField && data.get(confirmField) === confirmValue) ||
      Boolean(data && confirmUncheckedField && !data.has(confirmUncheckedField));
    if (shouldConfirm && !window.confirm(message)) event.preventDefault();
  }

  return <button className={className} name={name} onClick={confirm} type="submit" value={value}>{children}</button>;
}
