/**
 * Summarize Skill — Long document integration tests
 *
 * Tests summarization of multi-page documents (real content from the web).
 * Requires ANTHROPIC_API_KEY to be set.
 * These tests make real API calls to Anthropic via Claude Code CLI.
 */

import { describe, expect, test } from "bun:test";
import { summarize, requireAnthropicEnv } from "./summarize-helpers";

const LONG_TIMEOUT = 120_000;

// ── Test documents ───────────────────────────────────────────────────

const ALICE_CHAPTERS_1_3 = `CHAPTER I: Down the Rabbit-Hole

Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so VERY remarkable in that; nor did Alice think it so VERY much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be late!" (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.

In another moment down went Alice after it, never once considering how in the world she was to get out again.

The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.

Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled "ORANGE MARMALADE", but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.

"Well!" thought Alice to herself, "after a fall like this, I shall think nothing of tumbling down stairs! How brave they'll all think me at home! Why, I wouldn't say anything about it, even if I fell off the top of the house!" (Which was very likely true.)

Down, down, down. Would the fall NEVER come to an end? "I wonder how many miles I've fallen by this time?" she said aloud. "I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—" (for, you see, Alice had learnt several things of this sort in her lessons in the schoolroom, and though this was not a VERY good opportunity for showing off her knowledge, as there was no one to listen to her, still it was good practice to say it over) "—yes, that's about the right distance—but then I wonder what Latitude or Longitude I've got to?" (Alice had no idea what Latitude was, or Longitude either, but thought they were nice grand words to say.)

Presently she began again. "I wonder if I shall fall right THROUGH the earth! How funny it'll seem to come out among the people that walk with their heads downward! The Antipathies, I think—" (she was rather glad there WAS no one listening, this time, as it didn't sound at all the right word) "—but I shall have to ask them what the name of the country is, you know. Please, Ma'am, is this New Zealand or Australia?" (and she tried to curtsey as she spoke—fancy CURTSEYING as you're falling through the air! Do you think you could manage it?) "And what an ignorant little girl she'll think me for asking! No, it'll never do to ask: perhaps I shall see it written up somewhere."

Down, down, down. There was nothing else to do, so Alice soon began talking again. "Dinah'll miss me very much to-night, I should think!" (Dinah was the cat.) "I hope they'll remember her saucer of milk at tea-time. Dinah my dear! I wish you were down here with me! There are no mice in the air, I'm afraid, but you might catch a bat, and that's very like a mouse, you know. But do cats eat bats, I wonder?" And here Alice began to get rather sleepy, and went on saying to herself, in a dreamy sort of way, "Do cats eat bats? Do cats eat bats?" and sometimes, "Do bats eat cats?" for, you see, as she couldn't answer either question, it didn't much matter which way she put it. She felt that she was dozing off, and had just begun to dream that she was walking hand in hand with Dinah, and saying to her very earnestly, "Now, Dinah, tell me the truth: did you ever eat a bat?" when suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over.

Alice was not a bit hurt, and she jumped up on to her feet in a moment: she looked up, but it was all dark overhead; before her was another long passage, and the White Rabbit was still in sight, hurrying down it. There was not a moment to be lost: away went Alice like the wind, and was just in time to hear it say, as it turned a corner, "Oh my ears and whiskers, how late it's getting!" She was close behind it when she turned the corner, but the Rabbit was no longer to be seen: she found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof.

There were doors all round the hall, but they were all locked; and when Alice had been all the way down one side and up the other, trying every door, she walked sadly down the middle, wondering how she was ever to get out again.

Suddenly she came upon a little three-legged table, all made of solid glass; there was nothing on it except a tiny golden key, and Alice's first thought was that it might belong to one of the doors of the hall; but, alas! either the locks were too large, or the key was too small, but at any rate it would not open any of them. However, on the second time round, she came upon a low curtain she had not noticed before, and behind it was a little door about fifteen inches high: she tried the little golden key in the lock, and to her great delight it fitted!

Alice opened the door and found that it led into a small passage, not much larger than a rat-hole: she knelt down and looked along the passage into the loveliest garden you ever saw. How she longed to get out of that dark hall, and wander about among those beds of bright flowers and those cool fountains, but she could not even get her head through the doorway; "and even if my head would go through," thought poor Alice, "it would be of very little use without my shoulders. Oh, how I wish I could shut up like a telescope! I think I could, if I only knew how to begin." For, you see, so many out-of-the-way things had happened lately, that Alice had begun to think that very few things indeed were really impossible.

There seemed to be no use in waiting by the little door, so she went back to the table, half hoping she might find another key on it, or at any rate a book of rules for shutting people up like telescopes: this time she found a little bottle on it, ("which certainly was not here before," said Alice,) and round the neck of the bottle was a paper label, with the words "DRINK ME," beautifully printed on it in large letters.

It was all very well to say "Drink me," but the wise little Alice was not going to do THAT in a hurry. "No, I'll look first," she said, "and see whether it's marked 'poison' or not"; for she had read several nice little histories about children who had got burnt, and eaten up by wild beasts and other unpleasant things, all because they WOULD not remember the simple rules their friends had taught them: such as, that a red-hot poker will burn you if you hold it too long; and that if you cut your finger VERY deeply with a knife, it usually bleeds; and she had never forgotten that, if you drink much from a bottle marked "poison," it is almost certain to disagree with you, sooner or later.

However, this bottle was NOT marked "poison," so Alice ventured to taste it, and finding it very nice, (it had, in fact, a sort of mixed flavour of cherry-tart, custard, pine-apple, roast turkey, toffee, and hot buttered toast,) she very soon finished it off.

CHAPTER II: The Pool of Tears

"Curiouser and curiouser!" cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); "now I'm opening out like the largest telescope that ever was! Good-bye, feet!" (for when she looked down at her feet, they seemed to be almost out of sight, they were getting so far off). "Oh, my poor little feet, I wonder who will put on your shoes and stockings for you now, dears? I'm sure I sha'n't be able! I shall be a great deal too far off to trouble myself about you: you must manage the best way you can;—but I must be kind to them," thought Alice, "or perhaps they won't walk the way I want to go! Let me see: I'll give them a new pair of boots every Christmas."

And she went on planning to herself how she would manage it. "They must go by the carrier," she thought; "and how funny it'll seem, sending presents to one's own feet! And how odd the directions will look!

    ALICE'S RIGHT FOOT, ESQ.,
        HEARTHRUG,
            NEAR THE FENDER,
                (WITH ALICE'S LOVE).

Oh dear, what nonsense I'm talking!"

Just then her head struck against the roof of the hall: in fact she was now more than nine feet high, and she at once took up the little golden key and hurried off to the garden door.

Poor Alice! It was as much as she could do, lying down on one side, to look through into the garden with one eye; but to get through was more hopeless than ever: she sat down and began to cry again.

"You ought to be ashamed of yourself," said Alice, "a great girl like you," (she might well say this), "to go on crying in this way! Stop this moment, I tell you!" But she went on all the same, shedding gallons of tears, until there was a large pool all round her, about four inches deep and reaching half down the hall.

After a time she heard a little pattering of feet in the distance, and she hastily dried her eyes to see what was coming. It was the White Rabbit returning, splendidly dressed, with a pair of white kid gloves in one hand and a large fan in the other: he came trotting along in a great hurry, muttering to himself as he came, "Oh! the Duchess, the Duchess! Oh! won't she be savage if I've kept her waiting!"

CHAPTER III: A Caucus-Race and a Long Tale

They were indeed a queer-looking party that assembled on the bank—the birds with draggled feathers, the animals with their fur clinging close to them, and all dripping wet, cross, and uncomfortable.

The first question of course was, how to get dry again: they had a consultation about this, and after a few minutes it seemed quite natural to Alice to find herself talking familiarly with them, as if she had known them all her life. Indeed, she had quite a long argument with the Lory, who at last turned sulky, and would only say, "I am older than you, and must know better"; and this Alice would not allow without knowing how old it was, and, as the Lory positively refused to tell its age, there was no more to be said.

At last the Mouse, who seemed to be a person of authority among them, called out, "Sit down, all of you, and listen to me! I'LL soon make you dry enough!" They all sat down at once, in a large ring, with the Mouse in the middle. Alice kept her eyes anxiously fixed on it, for she felt sure she would catch a bad cold if she did not get dry very soon.

"Ahem!" said the Mouse with an important air, "are you all ready? This is the driest thing I know. Silence all round, if you please! 'William the Conqueror, whose cause was favoured by the pope, was soon submitted to by the English, who wanted leaders, and had been of late much accustomed to usurpation and conquest. Edwin and Morcar, the earls of Mercia and Northumbria—'"

"Ugh!" said the Lory, with a shiver.

"I beg your pardon!" said the Mouse, frowning, but very politely: "Did you speak?"

"Not I!" said the Lory hastily.

"I thought you did," said the Mouse. "—I proceed. 'Edwin and Morcar, the earls of Mercia and Northumbria, declared for him: and even Stigand, the patriotic archbishop of Canterbury, found it advisable—'"

"Found WHAT?" said the Duck.

"Found IT," the Mouse replied rather crossly: "of course you know what 'it' means."

"I know what 'it' means well enough, when I find a thing," said the Duck: "it's generally a frog or a worm. The question is, what did the archbishop find?"

The Mouse did not notice this question, but hurriedly went on, "'—found it advisable to go with Edgar Atheling to meet William and offer him the crown. William's conduct at first was moderate. But the insolence of his Normans—' How are you getting on now, my dear?" it continued, turning to Alice as it spoke.

"As wet as ever," said Alice in a melancholy tone: "it doesn't seem to dry me at all."

"In that case," said the Dodo solemnly, rising to its feet, "I move that the meeting adjourn, for the immediate adoption of more energetic remedies—"

"Speak English!" said the Eaglet. "I don't know the meaning of half those long words, and, what's more, I don't believe you do either!" And the Eaglet bent down its head to hide a smile: some of the other birds tittered audibly.

"What I was going to say," said the Dodo in an offended tone, "was, that the best thing to get us dry would be a Caucus-race."

"What IS a Caucus-race?" said Alice; not that she wanted much to know, but the Dodo had paused as if it thought that SOMEBODY ought to speak, and no one else seemed inclined to say anything.

"Why," said the Dodo, "the best way to explain it is to do it." (And, as you might like to try the thing yourself, some winter day, I will tell you how the Dodo managed it.)

First it marked out a race-course, in a sort of circle, ("the exact shape doesn't matter," it said,) and then all the party were placed along the course, here and there. There was no "One, two, three, and away," but they began running when they liked, and left off when they liked, so that it was not easy to know when the race was over. However, when they had been running half an hour or so, and were quite dry again, the Dodo suddenly called out "The race is over!" and they all crowded round it, panting, and asking, "But who has won?"

This question the Dodo could not answer without a great deal of thought, and it sat for a long time with one finger pressed upon its forehead (the position in which you usually see Shakespeare, in the pictures of him), while the rest waited in silence. At last the Dodo said, "EVERYBODY has won, and all must have prizes."`;

const HISTORY_OF_INTERNET = `History of the Internet

The Internet originated from efforts by scientists and engineers to build and interconnect computer networks. The Internet Protocol Suite emerged from research and development in the United States with significant international collaboration, particularly with researchers in the United Kingdom and France.

Precursors

Telegraphy laid the groundwork for digital communication through the electrical telegraph in the late 19th century, followed by radiotelegraphy in the early 20th century and telex services in the 1930s. These systems were limited to point-to-point communication between two endpoints.

Information theory provided crucial theoretical foundations. Claude Shannon's 1948 work established understanding of the trade-offs between signal quality, bandwidth, and error-free transmission.

Computers and modems evolved significantly in the 1950s. The mainframe computer model emerged, and devices like the Bell 101 modem allowed digital data transmission over telephone lines at low speeds, enabling data exchange between remote computers.

Time-sharing represented a major conceptual advance. Christopher Strachey filed a UK patent for time-sharing in February 1959. J.C.R. Licklider promoted this concept as an alternative to batch processing at Bolt Beranek and Newman. John McCarthy's 1959 memo at MIT broadened time-sharing to encompass multiple interactive user sessions, resulting in the Compatible Time-Sharing System.

Licklider envisioned a computer network in his 1960 paper "Man-Computer Symbiosis," proposing centers connected by wide-band communication lines for information storage and retrieval. In October 1962, he became director of the Information Processing Techniques Office at ARPA, with a mandate to interconnect the Department of Defense's main computers.

Packet Switching

The infrastructure at the time relied on circuit switching, which required dedicated communication lines. This approach proved vulnerable and inefficient.

Paul Baran of the RAND Corporation developed a concept of survivable networks for military use, proposing that information would be transmitted across a distributed network, divided into message blocks. His design aimed for high-speed digital communication but was never implemented.

Donald Davies at the National Physical Laboratory in the United Kingdom independently developed a similar concept beginning in 1965, designing it specifically for high-speed data communication in computer networks. He coined the term "packet switching," which became the standard terminology. This technique splits computer data into standardized chunks with routing information, transmitting them independently through a network.

ARPANET

Robert Taylor became head of the IPTO at ARPA in 1966, intending to realize Licklider's interconnected networking vision. He identified the inefficiency of managing multiple sets of user commands for different terminals and recognized that there ought to be one terminal that goes anywhere you want to go where you have interactive computing. This concept became ARPANET.

Lawrence Roberts joined the project in January 1967. At the October 1967 ACM Symposium on Operating Systems Principles, Roberts presented the ARPA net proposal based on Wesley Clark's idea to use Interface Message Processors to create a message switching network. Roger Scantlebury presented Donald Davies' work on packet switching at the same conference. Roberts incorporated Davies' packet-switching concepts, upgrading proposed communication speed from 2.4 kbit/s to 50 kbit/s.

Bolt Beranek and Newman received the contract to build the network. The first ARPANET link was established on October 29, 1969, between UCLA's Network Measurement Center and Stanford Research Institute. They typed the L and asked over the phone if they could see it. The response was affirmative, but the system crashed when they typed the G. Despite this initial failure, a revolution had begun.

By December 1969, a four-node network existed, with connections to UC Santa Barbara and the University of Utah. Steve Crocker, a UCLA graduate student, formed the Network Working Group in 1969. Working with Jon Postel and others, he initiated the Request for Comments process, publishing RFC 1 on April 7, 1969. The Network Control Program was completed in 1970.

TCP/IP

With numerous networking methods seeking interconnection, a unified method was needed. An International Network Working Group formed in 1972, with active members including Vint Cerf, Alex McKenzie, Donald Davies, Roger Scantlebury, Louis Pouzin, and Hubert Zimmermann.

Bob Kahn at DARPA recruited Vint Cerf to work on interconnection problems. By 1973, these groups had developed a fundamental reformulation in which the differences between network protocols were hidden by using a common internetworking protocol. Instead of the network being responsible for reliability, the hosts became responsible.

Cerf and Kahn published their ideas in May 1974, incorporating concepts implemented in the CYCLADES network. The specification was published as RFC 675 in December 1974. This document contains the first attested use of the term internet, as a shorthand for internetwork.

The software was redesigned as a modular protocol stack. Between 1976 and 1977, engineers proposed separating TCP's routing and transmission control functions into two discrete layers. This led to splitting the Transmission Control Program into the Transmission Control Protocol and Internet Protocol in version 3 in 1978. Version 4 was described in IETF RFC 791, 792, and 793 in September 1981. It was installed on SATNET in 1982 and ARPANET in January 1983 after the Department of Defense made it standard for military computer networking.

From ARPANET to NSFNET

After ARPANET had operated for several years, ARPA sought another agency to manage the network. In July 1975, it was transferred to the Defense Communications Agency. In 1983, the military portion was separated as MILNET.

The National Science Foundation created NSFNET in 1986 as a 56 kbit/s backbone supporting supercomputing centers. NSFNET was upgraded to 1.5 Mbit/s in 1988 and to T3 speeds of 45 Mbit/s in 1991. When NSFNET was decommissioned in 1995, its optical networking backbones transferred to commercial ISPs including MCI, PSINet, and Sprint.

The World Wide Web

The development of the World Wide Web by Tim Berners-Lee at CERN in 1989-90 linking hypertext documents created an accessible information system available from any network node. The dramatic expansion of Internet capacity through wave division multiplexing and fiber optic cable rollout in the mid-1990s revolutionized culture, commerce, and technology.

This enabled near-instant communication through email, instant messaging, voice over Internet Protocol telephone calls, video chat, and the World Wide Web with discussion forums, blogs, social networking services, and online shopping sites. The Internet's takeover of global communication was rapid: it communicated 1 percent of information through two-way telecommunications networks in 1993, 51 percent by 2000, and more than 97 percent by 2007.`;

const RFC_791_EXCERPT = `RFC 791: Internet Protocol Specification

Introduction

RFC 791, released in September 1981, establishes the foundational specification for the Internet Protocol version 4 (IPv4). Created by Jon Postel at USC's Information Sciences Institute, this document defines how data packets traverse interconnected computer networks.

The protocol addresses a fundamental challenge: enabling communication between computers connected through diverse network types. Rather than assuming reliable connections, IP treats each data unit independently, delegating reliability concerns to higher-level protocols like TCP.

Key Motivations and Scope

The Internet Protocol emerged from the need to interconnect packet-switched networks in what researchers called a "catenet." The specification focuses narrowly on essential functions: moving data blocks called datagrams from source to destination and handling cases where intermediate networks require smaller packet sizes.

Importantly, IP itself provides no guarantees about delivery, sequencing, or data integrity. The protocol provides for transmitting blocks of data called datagrams from sources to destinations but explicitly lacks mechanisms to augment end-to-end data reliability, flow control, sequencing, or other services commonly found in host-to-host protocols.

Operational Model

The architecture envisions internet modules residing in every host and gateway. These modules interpret addressing information and manage fragmentation when necessary. The system operates statelessly: each datagram travels as an independent entity with no virtual circuits or ongoing connections maintained between endpoints.

Protocol Hierarchy

IP occupies a specific position within the broader protocol stack. Higher-level protocols like TCP and UDP invoke IP to transmit their data, while IP itself calls upon local network protocols for actual transmission. This layered approach allows various network types to support internet communication transparently.

Core Functions: Addressing and Fragmentation

Addressing enables identifying both source and destination with fixed-length 32-bit addresses. Three address classes accommodate different network sizes: Class A for large networks with many hosts, Class B for medium networks, and Class C for many small networks.

Fragmentation resolves a critical incompatibility: networks support different maximum packet sizes. When a datagram exceeds a network's capacity, intermediate gateways can split it into smaller fragments for transmission. The destination reconstructs the original datagram from these pieces using identification fields and fragment offsets.

The Internet Header

The IP header contains twenty mandatory octets plus optional fields. Critical components include:

Version (4 bits): Currently version 4.
Header Length (4 bits): Measured in 32-bit words, minimum value is 5.
Type of Service (8 bits): Indicates quality preferences including precedence levels and preferences for delay, throughput, and reliability.
Total Length (16 bits): Entire datagram size in octets, enabling packets up to 65,535 bytes.
Identification (16 bits): Unique value helping reassemble fragmented datagrams.
Flags (3 bits): Controls including Don't Fragment and More Fragments indicators.
Fragment Offset (13 bits): Position in original datagram, measured in 8-octet units.
Time to Live (8 bits): Maximum seconds the datagram may exist, decremented at each hop.
Protocol (8 bits): Identifies the next-level protocol.
Header Checksum (16 bits): One's complement verification of header integrity.
Source and Destination Addresses (32 bits each): Network layer endpoints.

Type of Service Mechanisms

The TOS field uses eight bits for expressing service preferences. Three precedence bits indicate importance levels ranging from routine to network control. Additional bits express preferences for low delay, high throughput, or high reliability, though implementations typically optimize only two of these three parameters simultaneously.

Time to Live and Datagram Lifetime

The TTL field prevents datagrams from circulating indefinitely. Each router processing a datagram must decrement TTL by at least one, regardless of actual processing time. When TTL reaches zero, the datagram is destroyed. With a maximum value of 255 seconds, the theoretical maximum datagram lifetime is approximately 4.25 minutes.

Fragmentation Details

When a datagram exceeds the next network's maximum transmission unit, fragmentation occurs unless the Don't Fragment flag is set. The process divides data on 8-octet boundaries, creating multiple datagrams with identical headers except for adjusted length, offset, and flag fields.

Reassembly uses four identifying fields: source address, destination address, protocol number, and identification value. Fragments with matching values in these fields combine into the original datagram. The process requires 15 seconds as the recommended timeout for incomplete reassemblies.

Protocol Philosophy

The specification emphasizes conservative transmission and liberal reception. Implementations must send well-formed datagrams but accept datagrams with minor irregularities when the meaning remains clear. This pragmatic approach accommodates diverse implementations while maintaining functional compatibility.`;

// ── Tests ────────────────────────────────────────────────────────────

describe("summarize skill: long documents", () => {
  test(
    "summarizes 3 chapters of Alice in Wonderland (~3 pages)",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document: ALICE_CHAPTERS_1_3,
        guidance: "3-5 sentences covering the key events across all three chapters",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(data.summary.length).toBeGreaterThan(100);
      expect(data.summary.length).toBeLessThan(2000);
    },
    LONG_TIMEOUT
  );

  test(
    "summarizes History of the Internet article (~5 pages)",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document: HISTORY_OF_INTERNET,
        guidance: "A structured summary with one sentence per major era: precursors, ARPANET, TCP/IP, NSFNET, and the Web",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(data.summary.length).toBeGreaterThan(100);
      expect(data.summary.length).toBeLessThan(3000);
    },
    LONG_TIMEOUT
  );

  test(
    "summarizes RFC 791 technical spec (~4 pages)",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document: RFC_791_EXCERPT,
        guidance: "Technical audience. Bullet points covering: purpose, addressing, fragmentation, header fields, and design philosophy.",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(data.summary.length).toBeGreaterThan(100);
      expect(data.summary.length).toBeLessThan(3000);
    },
    LONG_TIMEOUT
  );

  test(
    "ELI5 guidance works on technical content",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document: RFC_791_EXCERPT,
        guidance: "Explain like I'm 5 years old, 2-3 sentences max",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(data.summary.length).toBeGreaterThan(20);
      // ELI5 should be short
      expect(data.summary.length).toBeLessThan(500);
    },
    LONG_TIMEOUT
  );

  test(
    "key-facts extraction guidance on historical content",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document: HISTORY_OF_INTERNET,
        guidance: "Extract only dates and facts. Format as: YYYY - fact. No prose.",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      // Should contain years
      expect(data.summary).toMatch(/19[0-9]{2}/);
      expect(data.summary.length).toBeGreaterThan(100);
    },
    LONG_TIMEOUT
  );
});
