import Link from "next/link"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { buttonVariants } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" className={cn(className)} {...props} />
}

type PaginationLinkProps = React.ComponentProps<typeof Link> & {
  isActive?: boolean
}

function PaginationLink({ className, isActive = false, ...props }: PaginationLinkProps) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size: "icon" }),
        className,
      )}
      {...props}
    />
  )
}

type PaginationDirectionProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href?: string
}

function PaginationPrevious({ className, href, children, ...props }: PaginationDirectionProps) {
  const classes = cn(
    buttonVariants({ variant: "ghost", size: "default" }),
    "gap-1 px-2.5 sm:pl-2.5",
    !href && "pointer-events-none opacity-50",
    className,
  )
  const content = (
    <>
      <ChevronLeft />
      <span>{children}</span>
    </>
  )

  return href ? (
    <Link href={href} className={classes} {...props}>
      {content}
    </Link>
  ) : (
    <span aria-disabled="true" tabIndex={-1} className={classes} {...props}>
      {content}
    </span>
  )
}

function PaginationNext({ className, href, children, ...props }: PaginationDirectionProps) {
  const classes = cn(
    buttonVariants({ variant: "ghost", size: "default" }),
    "gap-1 px-2.5 sm:pr-2.5",
    !href && "pointer-events-none opacity-50",
    className,
  )
  const content = (
    <>
      <span>{children}</span>
      <ChevronRight />
    </>
  )

  return href ? (
    <Link href={href} className={classes} {...props}>
      {content}
    </Link>
  ) : (
    <span aria-disabled="true" tabIndex={-1} className={classes} {...props}>
      {content}
    </span>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
