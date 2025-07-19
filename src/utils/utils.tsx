import { IconBrandFacebook, IconBrandGoogle, IconBrandLinkedin, IconBrandSnapchat, IconBrandTiktok, IconBrandTwitter } from "@tabler/icons-react";
import { JSX } from "react";
import { FaFacebook, FaGithub, FaInstagram, FaLinkedin, FaThreads, FaTwitter, FaXTwitter, FaYoutube } from "react-icons/fa6";

export const getPlatformIconByName = (platformName: string): JSX.Element | null => {
    switch (platformName) {
        case 'facebook': {
            return <FaFacebook size={24} className='min-w-fit' />;
        }
        case 'github': {
            return <FaGithub size={24} className='min-w-fit' />;
        }
        case 'instagram': {
            return <FaInstagram size={24} className='min-w-fit' />;
        }
        case 'linkedin': {
            return <FaLinkedin size={24} className='min-w-fit' />;
        }
        case 'threads': {
            return <FaThreads size={24} className='min-w-fit' />;
        }
        case 'twitter': {
            return <FaTwitter size={24} className='min-w-fit' />;
        }
        case 'youtube': {
            return <FaYoutube size={24} className='min-w-fit' />;
        }
        case 'x': {
            return <FaXTwitter size={24} className='min-w-fit' />;
        }
        default:
            console.log('Platform name not supported, no icon is returned:', platformName);
            return null;
    }
}

export const getPlatformIcon = (platformName: string, size: number = 24, stroke?: number) => {
    switch (platformName?.toLowerCase()) {
        case 'facebook':
        case 'meta':
            return <IconBrandFacebook size={size} stroke={stroke} />;
        case 'google':
            return <IconBrandGoogle size={24} stroke={stroke} />;
        case 'tiktok':
            return <IconBrandTiktok size={24} stroke={stroke} />;
        case 'snapchat':
            return <IconBrandSnapchat size={24} stroke={stroke} />;
        case 'linkedin':
            return <IconBrandLinkedin size={24} stroke={stroke} />;
        case 'twitter':
        case 'x':
            return <IconBrandTwitter size={24} stroke={stroke} />;
        default:
            return null;
    }
}

