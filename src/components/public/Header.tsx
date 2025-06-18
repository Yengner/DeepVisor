'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Transition } from '@headlessui/react';
import { HiOutlineXMark, HiBars3 } from 'react-icons/hi2';
import { FaChartPie } from 'react-icons/fa';
import Container from './Container';
import { menuItems } from '@/lib/static/menuItems';
import { siteDetails } from '@/lib/static/siteDetails';

const Header: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [proposalToken, setProposalToken] = useState<string | null>(null);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        // Check for proposalToken in localStorage
        const token = localStorage.getItem('proposalToken');
        if (token) {
            setProposalToken(token);
        }
    }, []);

    return (
        <header className="bg-transparent top-0 left-0 right-0 w-full z-50">
            <div className="w-full bg-white shadow-md">
                <Container className="!px-0">
                    <nav className="mx-auto flex items-center justify-between px-5 py-4 md:py-6">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link href="/" className="flex items-center gap-2">
                                <FaChartPie className="text-foreground min-w-fit w-12 h-7" />
                                <span className="manrope text-2xl font-semibold text-foreground cursor-pointer w-48">
                                    {siteDetails.siteName}
                                </span>
                            </Link>
                        </div>

                        {/* Center Menu */}
                        <div className="hidden md:flex items-center space-x-6">
                            <ul className="flex space-x-5">
                                {menuItems.map((item) => (
                                    <li key={item.text}>
                                        <Link
                                            href={item.url}
                                            className="text-foreground hover:text-primary-accent transition-colors"
                                        >
                                            {item.text}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Right Section */}
                        <div className="hidden md:flex items-center space-x-4">
                            {proposalToken ? (
                                <Link
                                    href={`/proposal/${proposalToken}`}
                                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white px-6 py-3 rounded-full text-lg font-bold shadow-lg hover:opacity-90 transition-opacity"
                                >
                                    Check Proposal
                                </Link>
                            ) : (
                                <Link
                                    href="https://forms.gle/opEmPnAhSiN1Nint5"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white bg-primary-accent hover:bg-gray-200 px-16 py-3 rounded-full transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                    <p className="text-lg font-extrabold">Free Quote !!</p>
                                </Link>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center">
                            <button
                                onClick={toggleMenu}
                                type="button"
                                className="bg-primary text-black focus:outline-none rounded-full w-10 h-10 flex items-center justify-center"
                                aria-controls="mobile-menu"
                                aria-expanded={isOpen}
                            >
                                {isOpen ? (
                                    <HiOutlineXMark className="h-6 w-6" aria-hidden="true" />
                                ) : (
                                    <HiBars3 className="h-6 w-6" aria-hidden="true" />
                                )}
                                <span className="sr-only">Toggle navigation</span>
                            </button>
                        </div>
                    </nav>
                </Container>
            </div>

            {/* Mobile Menu with Transition */}
            <Transition
                show={isOpen}
                enter="transition ease-out duration-200 transform"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75 transform"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
            >
                <div id="mobile-menu" className="md:hidden bg-white shadow-lg">
                    <ul className="flex flex-col space-y-4 pt-1 pb-6 px-6">
                        {menuItems.map((item) => (
                            <li key={item.text}>
                                <Link
                                    href={item.url}
                                    className="text-foreground hover:text-primary block"
                                    onClick={toggleMenu}
                                >
                                    {item.text}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </Transition>
        </header>
    );
};

export default Header;