"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight"
        >
          TREDIT
        </Link>

        {/* Desktop Menu */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Home
          </Link>

          <Link
            href="/products"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Products
          </Link>

          <Link
            href="/about"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            About
          </Link>

          <Link
            href="/contact"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Contact
          </Link>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-100"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Register
          </Link>
        </div>

        {/* Mobile Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden"
        >
          ☰
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="border-t md:hidden">
          <div className="flex flex-col p-4">
            <Link
              href="/"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Home
            </Link>

            <Link
              href="/products"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Products
            </Link>

            <Link
              href="/about"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              About
            </Link>

            <Link
              href="/contact"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Contact
            </Link>

            <hr className="my-3" />

            <Link
              href="/login"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-md bg-black px-3 py-2 text-center text-white"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}