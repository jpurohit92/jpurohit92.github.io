import taxonomy from './data/taxonomy.json';

// Single place to edit your personal details.
export const SITE = {
  name: 'Jatin Purohit',
  handle: 'jatinpurohit92',
  title: 'Jatin Purohit · Principal Technical Marketing Engineer',
  description:
    'Jatin Purohit is a Principal Technical Marketing Engineer with 12+ years of experience across cloud infrastructure, virtualization, developer platforms, automation, and technical product strategy.',
  role: 'Principal Technical Marketing Engineer',
  company: 'VMware Cloud Foundation · Broadcom',
  tagline: 'Principal Technical Marketing Engineer at VMware by Broadcom.',
  email: 'jpurohit92@outlook.com',
  github: 'https://github.com/jpurohit92',
  linkedin: 'https://www.linkedin.com/in/jatinpurohit92/',
  // Profile photo lives in /public.
  photo: '/profile.jpg',
};

// LinkedIn "About" summary, verbatim (one array item per paragraph).
export const SUMMARY = [
  'Jatin Purohit is a Principal Technical Marketing Engineer with 12+ years of experience across cloud infrastructure, virtualization, developer platforms, automation, and technical product strategy.',
  'At Broadcom’s VMware Cloud Foundation (VCF) division, he works at the intersection of product, engineering, developers, customers, and go-to-market teams, with a focus on developer experience, APIs, SDKs, CLI/PowerCLI, OpenAPI, automation, and private cloud platforms.',
  'His work involves translating complex platform capabilities into intuitive developer experiences, technical solutions, product narratives, demos, and enablement assets that help customers and partners adopt and automate enterprise cloud infrastructure. He regularly works with engineering and product teams to understand emerging platform capabilities, identify customer and developer requirements, and shape how those capabilities are positioned, consumed, and adopted.',
  'Over the course of his career, Jatin has worked across operations, engineering, automation, and technical marketing, giving him a strong understanding of the full technology lifecycle—from infrastructure operations and architecture to developer tooling, product adoption, and go-to-market execution.',
  'He is particularly interested in the convergence of AI, developer platforms, APIs, automation, and enterprise software, and in building products that make complex infrastructure easier for developers and enterprises to consume.',
  'Jatin is also an experienced industry speaker and has presented at VMware Explore, Oracle CloudWorld, VMUG, and other technical forums on private cloud, automation, developer experience, and modern infrastructure platforms.',
];

// Short intro for the home-page shell sequence (whoami / cat intro.md).
export const SUMMARY_SHORT = [
  'I’m a Principal Technical Marketing Engineer at VMware by Broadcom, with over 12 years of experience exploring, building, and working with cloud infrastructure, virtualization, developer platforms, and automation.',
  'A big part of what I do involves APIs, SDKs, PowerCLI, and private cloud technologies. I enjoy breaking down complex technical concepts, experimenting with new tools, and making infrastructure easier for developers to work with.',
  'Along the way, I’ve had the opportunity to share my experiences and learn from the community at events like VMware Explore, Oracle CloudWorld, and VMUG.',
];

// Blog categories shown in the filter sidebar (in this order), each with an Octicon name.
// Edit them in src/data/taxonomy.json (the only place categories and tags are defined).
// Categories with no posts yet still appear (count 0).
export const CATEGORIES: { name: string; icon: string }[] = taxonomy.categories;

export const NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/blog', label: 'Blog', icon: 'pencil' },
  { href: '/projects', label: 'Projects', icon: 'repo' },
  { href: '/about', label: 'About', icon: 'person' },
];

/** Prefix a path with the configured base (works for user and project Pages sites). */
export const url = (path: string) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};
