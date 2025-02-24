import { IMenuItem, ISocials } from "@/types/public/types.d";

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
            url: "/home"
        },
        {
            text: "Free Estimate",
            url: "/estimate"
        },
        {
            text: "Contact Us",
            url: "/contact-us"
        }
    ],
    email: 'deepvisormarketing@gmail.com',
    telephone: '+1 (813) 992-0108',
    socials: {
        // github: 'https://github.com',
        // x: 'https://twitter.com/x',
        twitter: 'https://twitter.com/Twitter',
        facebook: 'https://facebook.com',
        // youtube: 'https://youtube.com',
        linkedin: 'https://www.linkedin.com',
        // threads: 'https://www.threads.net',
        instagram: 'https://www.instagram.com',
    }
}