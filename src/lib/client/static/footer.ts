import { IMenuItem, ISocials } from "@/lib/static/types";

export const footerDetails: {
    subheading: string;
    quickLinks: IMenuItem[];
    email: string;
    telephone: string;
    socials: ISocials;
} = {
    subheading: "Empowering businesses with cutting-edge marketing technology solutions.",
    quickLinks: [
        {
            text: "Home",
            url: "/"
        },
        {
            text: "Contact Us",
            url: "/contact-us"
        },
        {
            text: "Investor Relations",
            url: "/investor-relations"
        },
        {
            text: "Privacy Policy",
            url: "/privacy-policy"
        },
    ],
    email: 'info@deepvisor.com',
    telephone: '+1 (813) 992-0108',
    socials: {
        github: 'https://github.com/Yengner/DeepVisor',
        facebook: 'https://www.facebook.com/profile.php?id=61555633384605#',
        // youtube: 'https://youtube.com',
        linkedin: 'https://www.linkedin.com/company/deepvisor-llc',
        // threads: 'https://www.threads.net',
        instagram: 'https://www.instagram.com/deepvisormarketing',
    }
}