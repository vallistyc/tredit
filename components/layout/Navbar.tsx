"use client";

import Link from "next/link";
import { useState } from "react";
import Logout from "@/components/Logout"

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
            href="/home"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Home
          </Link>

          <Link
            href="/deals"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Deals
          </Link>

          <Link
            href="/profile"
            className="text-sm font-medium text-gray-700 transition hover:text-black"
          >
            Profile
          </Link>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/register"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Add Pitch
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
              href="/home"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Home
            </Link>

            <Link
              href="/deals"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Deals
            </Link>

            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Profile
            </Link>

            <Link
              href="/listing/new"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-2 text-amber-400 font-semibold bg-[#4b00dc#4b00dc] hover:bg-[#2e0189]"
            >
              Add Pitch
            </Link>

            <hr className="my-3" />

            <Logout />
          </div>
        </div>
      )}
    </nav>
  );
}