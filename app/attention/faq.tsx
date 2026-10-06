'use client';

import {ArrowUpRight,Plus} from 'lucide-react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';
import {PublicHeader,PublicFooter} from '../ui/public';
import Link from '../ui/app-link';
import {MIN_INITIAL_BID,LISTING_DAYS} from './model';

const questions=[
  ['What is CollabCy Spotlight?', 'A place for independent brands and products to get discovered. Share what you’re building, add your website, and join a public board where visitors and creators can explore your product. Your bid determines your position in the active ranking.'],
  ['How much does it cost to list my brand?', `Listings start at $${MIN_INITIAL_BID}, which is your initial ranking bid. There is no separate listing fee. Choose a higher bid if you want to compete for a higher position, and review your total before continuing. New listings currently use demo checkout, so no real money is charged.`],
  ['How does the ranking work?', 'Active products are ordered by their current cumulative bid, from highest to lowest. If two bids are equal, the earlier bid keeps its place. The top three appear in the Brands hero, and every active product appears on the Listings board.'],
  ['Do I pay the full amount again to raise my bid?', 'You only pay the amount you add to your existing bid. For example, moving from $2 to $5 means a $3 add-on. Open your product’s bid form to see the minimum increase and projected rank before checkout.'],
  ['How do payments work?', 'New product listings currently use demo checkout with no card details or real charge. Bid increases use Dodo Payments in Test Mode and require a CollabCy account. A bid updates only after payment confirmation; returning from checkout alone does not change your rank.'],
  ['What is a sponsored spot?', 'A sponsored spot is a separate advertising placement, rather than a position earned through leaderboard bids. Sponsored placements are not currently available on CollabCy. When offered, they should be clearly marked so visitors can distinguish them from ranked products.'],
  ['How much do sponsored spots cost?', 'There are no sponsored placements available to purchase yet, so there is no published sponsored price. You can introduce your product through a standard Spotlight listing starting at $2. Any future sponsored offer will show its price and placement before checkout.'],
  ['Does sponsoring change my leaderboard rank?', 'Leaderboard rank is determined by your product’s current bid. A separate sponsored placement would not add to that bid or move your product up the ranking. Sponsorship is not currently offered on CollabCy.'],
  ['Do you guarantee a fixed number of clicks?', 'No. A listing gives your brand a place to be discovered, but visits depend on visitor interest, your product, and its position. A clear description, recognizable logo, and useful product page help people decide whether to explore further.'],
  ['What happens if someone outbids me?', `Their product moves ahead of yours. Your product stays listed until its ${LISTING_DAYS}-day listing period ends. You can increase your bid to compete for a higher position, or keep your existing bid. After expiry, your product leaves the active board and stops accepting bids; its detail page and history remain available.`],
];

export function SpotlightFAQ(){
  return <><PublicHeader/><main className="spotlight-page spotlight-faq-page"><section className="public-container faq-page-content">
    <nav className="faq-breadcrumb" aria-label="Breadcrumb"><Link href="/brands">Home</Link><span>/</span><span aria-current="page">FAQ</span></nav>
    <span className="editorial-kicker">A LITTLE CLARITY GOES A LONG WAY</span>
    <h1>Frequently asked questions</h1>
    <p className="faq-page-intro">Your spotlight starts at <strong>${MIN_INITIAL_BID}.</strong> Higher bids rank higher. <span>Pay only the difference to move up.</span></p>
    <div className="faq-page-columns">{[questions.slice(0,5),questions.slice(5)].map((column,index)=><Accordion key={index} type="single" collapsible className="faq-page-column">{column.map(([question,answer],item)=><AccordionItem value={`${index}-${item}`} key={question}><AccordionTrigger><span>{question}</span><Plus className="faq-plus" size={18} aria-hidden="true"/></AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}</Accordion>)}</div>
    <div className="faq-page-footer"><div><strong>Ready for your moment?</strong><p>Introduce your brand. Let the right people find it.</p></div><Link href="/brand/products/new" className="btn btn-primary spotlight-button"><span>Spotlight your brand</span><ArrowUpRight size={18}/></Link></div>
  </section></main><PublicFooter/></>;
}
