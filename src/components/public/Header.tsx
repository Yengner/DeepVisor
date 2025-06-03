'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { Transition } from '@headlessui/react';
import { HiOutlineXMark, HiBars3 } from 'react-icons/hi2';
import { FaChartPie } from 'react-icons/fa';
//FaUserPlus FaSignInAlt
// import { FiPlayCircle } from 'react-icons/fi';

import Container from './Container';
import { menuItems } from '@/lib/static/menuItems';
import { siteDetails } from '@/lib/static/siteDetails';
// import { demoLogin } from '@/lib/static/demo';


const Header: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    // async function handleDemoLogin() {
    //     try {
    //         const session = await demoLogin();
    //         if (session) {
    //             window.location.href = '/dashboard/platforms'; // Redirect to the dashboard
    //         }
    //     } catch (error) {
    //         console.error(error);
    //         alert('Failed to log in to the demo account.');
    //     }
    // };

    return (
        <header className="bg-transparent fixed top-0 left-0 right-0 md:absolute z-50 mx-auto w-full">
            <Container className="!px-0">
                <nav className="shadow-md md:shadow-none bg-white md:bg-transparent mx-auto flex items-center justify-between px-5 md:py-10">
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
                            {menuItems.map(item => (
                                <li key={item.text}>
                                    <Link href={item.url} className="text-foreground hover:text-primary-accent transition-colors">
                                        {item.text}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Section */}
                    
                    <div className="hidden md:flex items-center space-x-4">
                        <div>
                            <Link
                                href="https://forms.gle/opEmPnAhSiN1Nint5"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white bg-primary-accent hover:bg-gray-200 px-16 py-3 rounded-full transition-colors flex items-center gap-2 cursor-pointer"
                            >
                                <p className='text-lg font-extrabold'>
                                    Free Quote !!
                                </p>
                            </Link>
                        </div>
                    
                        {/* <div>
                            <button
                                onClick={handleDemoLogin}
                                className="text-black hover:text-primary-accent px-2 py-2 rounded-full transition-colors flex items-center gap-2 cursor-pointer"
                            >
                                <FiPlayCircle className="w-5 h-5" />
                                Demo
                            </button>
                        </div>
                        <div className="group">
                            <Link
                                href="/signup"
                                className="text-black hover:text-primary-accent transition-colors flex items-center gap-2"
                            >
                                <FaUserPlus className="w-5 h-5" />
                                Sign Up
                            </Link>
                        </div>
                        <div className="group">
                            <Link
                                href="/login"
                                className="text-black hover:text-primary-accent transition-colors flex items-center gap-2"
                            >
                                <FaSignInAlt className="w-5 h-5" />
                                Login
                            </Link>
                        </div> */}
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
                        {menuItems.map(item => (
                            <li key={item.text}>
                                <Link href={item.url} className="text-foreground hover:text-primary block" onClick={toggleMenu}>
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