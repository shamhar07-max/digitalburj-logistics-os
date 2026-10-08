import { Slot } from '@radix-ui/react-slot'
import type { ComponentProps } from 'react'
import { cls } from '../../lib/format'
// shadcn-style composition with DigitalBurj's established button tokens.
export function Button({ asChild = false, className, ...props }: ComponentProps<'button'> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cls('btn', className)} {...props} />
}
