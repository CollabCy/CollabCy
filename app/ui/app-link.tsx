"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { toInAppPath } from "@/lib/app-origin";

type AppLinkProps = ComponentProps<typeof NextLink>;

function safeHref(href: AppLinkProps["href"]): AppLinkProps["href"] {
  if (typeof href === "string") return toInAppPath(href);
  if (href && typeof href === "object" && "pathname" in href) {
    return { ...href, pathname: toInAppPath(href.pathname || "/") };
  }
  return href;
}

export default function Link({ href, ...props }: AppLinkProps) {
  return <NextLink href={safeHref(href)} {...props} />;
}
