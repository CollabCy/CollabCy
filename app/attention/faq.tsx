'use client';

import {ArrowUpRight,Plus} from 'lucide-react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';
import {PublicHeader,PublicFooter} from '../ui/public';
import Link from '../ui/app-link';
import {MIN_INITIAL_BID} from './model';

const questions=[
  ['What is the Attention Marketplace?', 'A public board where brands list products for discovery. Visitors can browse listings, open product pages, and visit websites. Your cumulative bid determines your position among active products.'],
  ['How much does it cost to list a product?', `There is no separate listing fee. You choose an initial spotlight bid from $${MIN_INITIAL_BID}. That amount is paid through Dodo, and it becomes your listing’s current bid after payment is confirmed.`],
  ['How does ranking work?', 'Products with higher current bids rank higher. When bids are equal, the earlier bid keeps its position. Ranking formulas are unchanged. Paid bid add-ons are applied after Dodo Payments confirms payment.'],
  ['Do I pay the full amount again to raise my bid?', `You only pay the add-on. The minimum add-on is always $${MIN_INITIAL_BID}, even if a higher amount is recommended to reach #1. Open Place a bid to preview your projected rank, then pay the amount you enter through Dodo Payments checkout.`],
  ['How do payments work?', `Your initial spotlight bid and later bid increases both use Dodo Payments. Rankings update only after payment confirmation; returning from checkout alone does not change your rank. There is no separate listing fee.`],
  ['Do I need an account to place a bid?', 'No. Browsing, visiting a website, listing a product, and placing a bid do not require a CollabCy account. Complete Dodo Payments checkout to pay the add-on. Returning from checkout is not proof of payment.'],
  ['Can I use the marketplace only for website visits?', 'Yes. Attention Marketplace listings are for product discovery, visibility, and website traffic.'],
  ['What is a sponsored spot?', 'A sponsored spot would be a separate advertising placement, rather than a position earned through leaderboard bids. Sponsored placements are not currently available on CollabCy.'],
  ['Do you guarantee a fixed number of clicks?', 'No. A listing gives your brand a place to be discovered, but visits depend on visitor interest, your product, and its position.'],
  ['What happens if someone outbids me?', 'Their product moves ahead of yours. Your product stays listed. You can increase your bid to compete for a higher position, or keep your existing bid.'],
];

export function SpotlightFAQ(){
  return <><PublicHeader/><main className="spotlight-page spotlight-faq-page"><section className="public-container faq-page-content">
    <nav className="faq-breadcrumb" aria-label="Breadcrumb"><Link href="/">Discover</Link><span>/</span><span aria-current="page">FAQ</span></nav>
    <span className="editorial-kicker">A LITTLE CLARITY GOES A LONG WAY</span>
    <h1>Frequently asked questions</h1>
    <p className="faq-page-intro">Bids start at <strong>${MIN_INITIAL_BID}.</strong> Higher bids rank higher. <span>Pay only the add-on through Dodo Payments.</span></p>
    <div className="faq-page-columns">{[questions.slice(0,5),questions.slice(5)].map((column,index)=><Accordion key={index} type="single" collapsible className="faq-page-column">{column.map(([question,answer],item)=><AccordionItem value={`${index}-${item}`} key={question}><AccordionTrigger><span>{question}</span><Plus className="faq-plus" size={18} aria-hidden="true"/></AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}</Accordion>)}</div>
    <div className="faq-page-footer"><div><strong>Ready for your moment?</strong><p>Introduce your product. Let the right people find it.</p></div><Link href="/brand/products/new" className="btn btn-primary spotlight-button"><span>Spotlight your brand</span><ArrowUpRight size={18}/></Link></div>
  </section></main><PublicFooter/></>;
}
