"use strict";

/* ═══════════════════════════════════════════════════════════════
   OSINT DATA — parsed from "OSINT tool collection.xlsx"
   Importance: red=critical, orange=relevant, yellow=occasional, default=standard
   ═══════════════════════════════════════════════════════════════ */

const OSINT_URLS = {
  'VirusTotal':                          'https://www.virustotal.com',
  'Alienvault OTX':                      'https://otx.alienvault.com',
  'Whois.DomainTools':                   'https://whois.domaintools.com',
  'Shodan/Censys':                       'https://www.shodan.io',
  'AbuseIPDB':                           'https://www.abuseipdb.com',
  'PhishStats':                          'https://phishstats.info',
  'Greynoise':                           'https://www.greynoise.io',
  'Crt.sh':                              'https://crt.sh',
  'Tor Metrics':                         'https://metrics.torproject.org',
  'IPVoid':                              'https://www.ipvoid.com',
  'ThreatMiner':                         'https://www.threatminer.org',
  'Ipinfo.io':                           'https://ipinfo.io',
  'Urlscan.io':                          'https://urlscan.io',
  'SSL Labs':                            'https://www.ssllabs.com/ssltest/',
  'URLhaus':                             'https://urlhaus.abuse.ch',
  'Robtex':                              'https://www.robtex.com',
  'SecurityTrails':                      'https://securitytrails.com',
  'ExpandURL':                           'https://www.expandurl.net',
  'HostingChecker':                      'https://hostingchecker.com',
  'Whatsmydns':                          'https://www.whatsmydns.net',
  'Miniwebtool':                         'https://miniwebtool.com/domain-age-checker/',
  'Wayback Machine':                     'https://web.archive.org',
  'MalwareBazaar':                       'https://bazaar.abuse.ch',
  'HashSets (NSRL)':                     'https://www.hashsets.com',
  'ANY.RUN/Triage/Hybrid-Analysis':      'https://any.run',
  'Triage/ANY.RUN/Hybrid Analysis':      'https://any.run',
  'Exploit DB/ Packet Storm':            'https://www.exploit-db.com',
  'NIST National Vulnerability Database':'https://nvd.nist.gov',
  'Malpedia':                            'https://malpedia.caad.fkie.fraunhofer.de',
  'MITRE ATT&CK':                        'https://attack.mitre.org',
  "GCK'S File Signatures Table":         'https://www.garykessler.net/library/file_sigs.html',
  'Nslookup':                            'https://mxtoolbox.com/NetworkTools.aspx',
};

const OSINT_TABLES = [
  {
    id: 'ip-addresses',
    name: 'IP Addresses',
    tools: [
      {
        name: 'Whois.DomainTools',
        importance: 'orange',
        tags: ['Identify IP owner and certificate', 'Relation between IP and domains'],
        comment: '',
      },
      {
        name: 'VirusTotal',
        importance: 'red',
        tags: ['Check if IP is known to be malicious', 'Identify IP owner and certificate', 'Relation between IP and domains', 'Find communicating and referring files'],
        comment: 'Check for maliciousness of an IP. Also tells you what you must look for to investigate further.',
      },
      {
        name: 'Alienvault OTX',
        importance: 'red',
        tags: ['Check if IP is known to be malicious', 'Relation between IP and domains', 'Find open ports', 'Find communicating and referring files'],
        comment: 'Check for maliciousness of an IP. Also tells you what you must look for to investigate further.',
      },
      {
        name: 'Nslookup',
        importance: 'red',
        tags: ['Relation between IP and domains'],
        comment: 'Key information about TU/e hosts.',
      },
      {
        name: 'Ping',
        importance: 'orange',
        tags: ['Ping an IP', 'Relation between IP and domains'],
        comment: '',
      },
      {
        name: 'ThreatMiner',
        importance: 'default',
        tags: ['Identify IP owner and certificate', 'Relation between IP and domains', 'Find communicating and referring files'],
        comment: '',
      },
      {
        name: 'Shodan/Censys',
        importance: 'default',
        tags: ['Identify IP owner and certificate', 'Find open ports'],
        comment: '',
      },
      {
        name: 'Ipinfo.io',
        importance: 'default',
        tags: ['Identify IP owner and certificate', 'Relation between IP and domains'],
        comment: '',
      },
      {
        name: 'AbuseIPDB',
        importance: 'default',
        tags: ['Check if IP is known to be malicious'],
        comment: '',
      },
      {
        name: 'PhishStats',
        importance: 'default',
        tags: ['Check if IP is known to be malicious'],
        comment: '',
      },
      {
        name: 'Greynoise',
        importance: 'default',
        tags: ['Check if IP is known to be malicious'],
        comment: '',
      },
      {
        name: 'Crt.sh',
        importance: 'default',
        tags: ['View historical certificates'],
        comment: '',
      },
      {
        name: 'Tor Metrics',
        importance: 'orange',
        tags: ['Check if an IP address is a TOR node'],
        comment: '',
      },
      {
        name: 'IPVoid',
        importance: 'default',
        tags: ['Check if IP is known to be malicious', 'Identify IP owner and certificate', 'Relation between IP and domains'],
        comment: '',
      },
    ],
  },
  {
    id: 'domains-urls',
    name: 'Domains & URLs',
    tools: [
      {
        name: 'Whois.DomainTools',
        importance: 'red',
        tags: ['Identify domain owner', 'Find IPs of domain', 'View a website w/o visiting it'],
        comment: 'Gives more information about the domain, and may be a quicker way to view a website without visiting.',
      },
      {
        name: 'VirusTotal',
        importance: 'red',
        tags: ['Find subdomains', 'Find IPs of domain', 'Check CA / historical certificates', 'Check if domain is known to be malicious', 'Find redirections', 'Check if domain is DGA domain', 'Find communicating files'],
        comment: 'Investigating a domain or URL.',
      },
      {
        name: 'Alienvault OTX',
        importance: 'red',
        tags: ['Identify domain owner', 'Find IPs of domain', 'Check if domain is known to be malicious', 'Check if domain is DGA domain', 'Find communicating files'],
        comment: 'Investigating a domain or URL.',
      },
      {
        name: 'Urlscan.io',
        importance: 'red',
        tags: ['Find IPs of domain', 'Check CA / historical certificates', 'Find redirections', 'Find communicating files', 'View a website w/o visiting it', 'Identify fake domains'],
        comment: 'Investigating a domain or URL. Also gives you more information about the URL and its behaviour. For most analyses, this additional information is not necessary to get a general idea of the domain.',
      },
      {
        name: 'SSL Labs',
        importance: 'red',
        tags: ['Find SSL configuration'],
        comment: "Check whether a customer's webserver is vulnerable to the attack.",
      },
      {
        name: 'ThreatMiner',
        importance: 'default',
        tags: ['Identify domain owner', 'Find subdomains', 'Find IPs of domain', 'Find communicating files'],
        comment: '',
      },
      {
        name: 'Triage/ANY.RUN/Hybrid Analysis',
        importance: 'default',
        tags: ['View a website w/o visiting it'],
        comment: '',
      },
      {
        name: 'URLhaus',
        importance: 'default',
        tags: ['Check if domain is known to be malicious'],
        comment: '',
      },
      {
        name: 'Robtex',
        importance: 'default',
        tags: ['Find subdomains', 'Find IPs of domain'],
        comment: '',
      },
      {
        name: 'PhishStats',
        importance: 'default',
        tags: ['Check if domain is known to be malicious'],
        comment: '',
      },
      {
        name: 'SecurityTrails',
        importance: 'default',
        tags: ['Find subdomains'],
        comment: '',
      },
      {
        name: 'Crt.sh',
        importance: 'default',
        tags: ['Check CA / historical certificates'],
        comment: '',
      },
      {
        name: 'ExpandURL',
        importance: 'default',
        tags: ['Find long URL from short URL'],
        comment: '',
      },
      {
        name: 'HostingChecker',
        importance: 'default',
        tags: ['Check if domain is owned by hosting service'],
        comment: '',
      },
      {
        name: 'Whatsmydns',
        importance: 'default',
        tags: ['Check domain age'],
        comment: '',
      },
      {
        name: 'Miniwebtool',
        importance: 'default',
        tags: ['Identify fake domains'],
        comment: '',
      },
      {
        name: 'Wayback Machine',
        importance: 'default',
        tags: [],
        comment: '',
      },
    ],
  },
  {
    id: 'file-hashes',
    name: 'File Hashes',
    tools: [
      {
        name: 'VirusTotal',
        importance: 'red',
        tags: ['Find links to malicious domain', 'Get a general idea of the file'],
        comment: '',
      },
      {
        name: 'Alienvault OTX',
        importance: 'red',
        tags: ['Find links to malicious domain', 'Get a general idea of the file'],
        comment: '',
      },
      {
        name: 'ANY.RUN/Triage/Hybrid-Analysis',
        importance: 'yellow',
        tags: ['Sandbox', 'Collect PCAP of malware traffic'],
        comment: "If VirusTotal and Alienvault don't agree with each other, treat the result as inconclusive and use sandbox reports.",
      },
      {
        name: 'MalwareBazaar',
        importance: 'orange',
        tags: ['Cross reference against known file hashes', 'Find links to malicious domain'],
        comment: 'When both VirusTotal and Alienvault OTX tell you that the file hash you have submitted matches the hash of a malicious file. Also used if sandbox mode is used.',
      },
      {
        name: 'HashSets (NSRL)',
        importance: 'orange',
        tags: ['Cross reference against known file hashes'],
        comment: 'Used in case sandbox needs to be used.',
      },
    ],
  },
  {
    id: 'attack-descriptions',
    name: 'Attack Descriptions',
    tools: [
      {
        name: 'Exploit DB/ Packet Storm',
        importance: 'red',
        tags: ['Find IOCs', 'Discover intermediate steps', 'Estimate goal and severity', 'Check if attack succeeded', 'Find vulnerability and vulnerable systems', 'Discover mitigations'],
        comment: 'If you know the name of the vulnerability or exploit, go to Exploit Database or Packet Storm.',
      },
      {
        name: 'NIST National Vulnerability Database',
        importance: 'red',
        tags: ['Estimate goal and severity', 'Find vulnerability and vulnerable systems', 'Discover mitigations'],
        comment: 'If you have a CVE number, use a CVE database such as the NIST National Vulnerability Database.',
      },
      {
        name: 'Malpedia',
        importance: 'red',
        tags: ['Estimate goal and severity'],
        comment: 'If you know the name of the malware used in the attack, use Malpedia.',
      },
    ],
  },
  {
    id: 'ttps-profiling',
    name: 'TTPs & Attacker Profiling',
    tools: [
      {
        name: 'MITRE ATT&CK',
        importance: 'red',
        tags: ['Determine severity', 'Perform triage', 'Determine attack phase', 'Determine attacker level', 'Find specific attacker or attacker group'],
        comment: 'Contains all the information to achieve the objectives. No need to use Google for additional info. Trusted source with good reputation.',
      },
      {
        name: 'Alienvault OTX',
        importance: 'yellow',
        tags: ['Determine attacker level', 'Find specific attacker or attacker group'],
        comment: 'Can be used for many other purposes as well. However, loading times can be relatively long compared to other tools.',
      },
      {
        name: 'Malpedia',
        importance: 'yellow',
        tags: ['Determine severity', 'Determine attacker level', 'Find specific attacker or attacker group'],
        comment: 'Simple and clean interface. Descriptions of malware families and threat actors are short and straight to the point.',
      },
    ],
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous',
    tools: [
      {
        name: "GCK'S File Signatures Table",
        importance: 'yellow',
        tags: ['Check which filetype is captured in the PCAP'],
        comment: 'A list of traffic snippets to recognize the file type being sent. Cross-reference the first few bytes (the signature) of the traffic stream in the PCAP against this list. In some cases, check the trailer bytes instead — noted in bold in the table.',
      },
    ],
  },
];

/* Importance rank used when merging duplicates — highest wins */
const IMP_RANK = { red: 4, orange: 3, yellow: 2, default: 1 };

/* Deduplicated tools: same name across tables → merged goals (each carrying its
   own note), merged tags, highest importance. Comments are stored per-goal so
   no note is ever lost when a tool appears in multiple tables. */
const OSINT_DEDUPED = (() => {
  const map = new Map();
  for (const table of OSINT_TABLES) {
    for (const tool of table.tools) {
      const key = tool.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          name:       tool.name,
          importance: tool.importance,
          goals:      [{ id: table.id, name: table.name, comment: tool.comment }],
          tags:       new Set(tool.tags),
          url:        OSINT_URLS[tool.name] || null,
        });
      } else {
        const e = map.get(key);
        if (!e.goals.some(g => g.id === table.id))
          e.goals.push({ id: table.id, name: table.name, comment: tool.comment });
        for (const t of tool.tags) e.tags.add(t);
        if (IMP_RANK[tool.importance] > IMP_RANK[e.importance])
          e.importance = tool.importance;
      }
    }
  }
  return [...map.values()].map(e => ({ ...e, tags: [...e.tags].sort() }));
})();

/* All unique tags from deduped entries for the filter dropdown */
const OSINT_ALL_TAGS = (() => {
  const set = new Set();
  for (const e of OSINT_DEDUPED) for (const t of e.tags) set.add(t);
  return [...set].sort();
})();
