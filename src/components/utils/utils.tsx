import { IconBrandGoogle, IconBrandLinkedin, IconBrandMeta, IconBrandSnapchat, IconBrandTiktok, IconBrandTwitter } from "@tabler/icons-react";

export const getPlatformIcon = (platformName: string, size: number = 24, stroke?: number) => {
    switch (platformName?.toLowerCase()) {
        case 'meta':
        case 'facebook':
            return <IconBrandMeta size={size} stroke={stroke} />;
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
