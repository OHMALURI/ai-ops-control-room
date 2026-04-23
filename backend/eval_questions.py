"""
eval_questions.py — 60 LLM evaluation questions across 4 categories.

Categories:
  - reasoning  (15): logical deduction, inference, analogy, causal, abstract
  - math        (15): arithmetic, algebra, geometry, probability, combinatorics
  - knowledge   (15): science, history, geography, technology, general facts
  - security    (15): cybersecurity concepts, attacks, and defences

Each question has:
  id               : unique int across all categories
  category         : "reasoning" | "math" | "knowledge" | "security"
  input            : the question / prompt sent to the model
  expected_output  : correct answer
  expected_behavior: "answer"
  context          : supporting facts used by the judge to score the answer
"""

REASONING_QUESTIONS = [
    {
        "id": 1,
        "category": "reasoning",
        "input": "All mammals are warm-blooded. Whales are mammals. Are whales warm-blooded?",
        "expected_output": "Yes, whales are warm-blooded because all mammals are warm-blooded and whales are mammals.",
        "expected_behavior": "answer",
        "context": [
            "Mammals are a class of animals characterised by warm blood, vertebrae, and nursing young with milk.",
            "Whales belong to the order Cetacea, which is classified under class Mammalia.",
        ],
    },
    {
        "id": 2,
        "category": "reasoning",
        "input": "A is taller than B. B is taller than C. Who is the shortest among A, B, and C?",
        "expected_output": "C is the shortest.",
        "expected_behavior": "answer",
        "context": [
            "Transitive property: if A > B and B > C, then A > B > C, making C the smallest.",
        ],
    },
    {
        "id": 3,
        "category": "reasoning",
        "input": "If it rains, the ground gets wet. The ground is wet. Does this prove it rained?",
        "expected_output": "No. The ground could be wet for other reasons (sprinklers, flooding, etc.). This is the logical fallacy of affirming the consequent.",
        "expected_behavior": "answer",
        "context": [
            "Affirming the consequent is an invalid form of deductive reasoning.",
            "Rain is sufficient but not necessary for the ground to be wet.",
        ],
    },
    {
        "id": 4,
        "category": "reasoning",
        "input": "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?",
        "expected_output": "The ball costs $0.05 (5 cents). If the ball = x, then the bat = x + 1.00, and x + (x + 1.00) = 1.10, so 2x = 0.10, x = 0.05.",
        "expected_behavior": "answer",
        "context": [
            "Classic cognitive reflection test question. The intuitive but wrong answer is 10 cents.",
            "Correct algebra: ball = (1.10 - 1.00) / 2 = 0.05.",
        ],
    },
    {
        "id": 5,
        "category": "reasoning",
        "input": "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
        "expected_output": "42. The differences are 4, 6, 8, 10, 12 -- increasing by 2 each time. 30 + 12 = 42.",
        "expected_behavior": "answer",
        "context": [
            "The nth term is n*(n+1): 1x2=2, 2x3=6, 3x4=12, 4x5=20, 5x6=30, 6x7=42.",
        ],
    },
    {
        "id": 6,
        "category": "reasoning",
        "input": "If all Blips are Blops, and some Blops are Blaps, can we conclude that some Blips are Blaps?",
        "expected_output": "Not necessarily. The Blops that are also Blaps might not overlap with the Blops that come from Blips.",
        "expected_behavior": "answer",
        "context": [
            "Categorical syllogism: 'All A are B' + 'Some B are C' does not guarantee 'Some A are C'.",
        ],
    },
    {
        "id": 7,
        "category": "reasoning",
        "input": "Book is to reading as fork is to ___?",
        "expected_output": "Eating. A book is the tool used for reading; a fork is the tool used for eating.",
        "expected_behavior": "answer",
        "context": [
            "Analogy type: tool-to-function relationship.",
        ],
    },
    {
        "id": 8,
        "category": "reasoning",
        "input": "Mary's father has five daughters: Nana, Nene, Nini, Nono. What is the name of the fifth daughter?",
        "expected_output": "Mary. The question states that Mary's father has five daughters, and Mary is one of them.",
        "expected_behavior": "answer",
        "context": [
            "Attention and reading-comprehension trap. Mary is mentioned in the question itself.",
        ],
    },
    {
        "id": 9,
        "category": "reasoning",
        "input": "If you overtake the person in second place in a race, what position are you in?",
        "expected_output": "Second place. You take the position of the person you overtook.",
        "expected_behavior": "answer",
        "context": [
            "Common trick question. Overtaking second place puts you in second, not first.",
        ],
    },
    {
        "id": 10,
        "category": "reasoning",
        "input": "A rooster lays an egg on the peak of a roof. Which way does the egg roll?",
        "expected_output": "Roosters don't lay eggs -- only hens do. So there is no egg to roll.",
        "expected_behavior": "answer",
        "context": [
            "Roosters are male chickens and cannot lay eggs.",
        ],
    },
    {
        "id": 11,
        "category": "reasoning",
        "input": "Doctors without borders treat patients in war zones. Dr. Ahmed is in a war zone treating patients. Is Dr. Ahmed necessarily from Doctors Without Borders?",
        "expected_output": "No. There could be other organisations or independent doctors working in war zones. The conclusion does not follow necessarily.",
        "expected_behavior": "answer",
        "context": [
            "Undistributed middle fallacy: other groups also treat patients in war zones.",
        ],
    },
    {
        "id": 12,
        "category": "reasoning",
        "input": "A man builds a house with all four sides facing south. A bear walks by. What colour is the bear?",
        "expected_output": "White. A house where all four sides face south can only be built at the North Pole, where polar bears live.",
        "expected_behavior": "answer",
        "context": [
            "At the North Pole, every direction from a point is south.",
            "Polar bears, which are white, inhabit the North Pole region.",
        ],
    },
    {
        "id": 13,
        "category": "reasoning",
        "input": "If today is Wednesday and the meeting was three days ago, what day was the meeting?",
        "expected_output": "Sunday. Three days before Wednesday: Tuesday, Monday, Sunday.",
        "expected_behavior": "answer",
        "context": [
            "Day arithmetic: Wednesday minus 3 days = Sunday.",
        ],
    },
    {
        "id": 14,
        "category": "reasoning",
        "input": "Cause: Sales dropped 40% after a price increase. What is the most likely conclusion?",
        "expected_output": "The price increase caused customers to buy less, making the product too expensive relative to alternatives. Demand is elastic.",
        "expected_behavior": "answer",
        "context": [
            "Price elasticity of demand: when price rises significantly, quantity demanded typically falls.",
        ],
    },
    {
        "id": 15,
        "category": "reasoning",
        "input": "You have a 3-litre jug and a 5-litre jug. How do you measure exactly 4 litres of water?",
        "expected_output": "Fill the 5L jug. Pour into the 3L jug until full (leaves 2L in 5L). Empty 3L jug. Pour the 2L into 3L jug. Fill 5L jug again. Pour from 5L into 3L until full (1L goes in, leaving 4L in 5L jug).",
        "expected_behavior": "answer",
        "context": [
            "Water-pouring puzzle solvable via state-space search.",
            "Steps: fill 5, pour to 3 (5 has 2), empty 3, pour 2 into 3, fill 5, pour 1 into 3 (5 has 4).",
        ],
    },
]

MATH_QUESTIONS = [
    {
        "id": 16,
        "category": "math",
        "input": "What is the sum of the interior angles of a hexagon?",
        "expected_output": "720 degrees. Formula: (n - 2) x 180 = (6 - 2) x 180 = 720.",
        "expected_behavior": "answer",
        "context": [
            "The sum of interior angles of a polygon with n sides = (n - 2) x 180 degrees.",
        ],
    },
    {
        "id": 17,
        "category": "math",
        "input": "Solve for x: 3x + 7 = 22",
        "expected_output": "x = 5. Subtract 7 from both sides: 3x = 15. Divide by 3: x = 5.",
        "expected_behavior": "answer",
        "context": [
            "Linear equation in one variable. Isolate x by inverse operations.",
        ],
    },
    {
        "id": 18,
        "category": "math",
        "input": "A train travels 300 km in 2.5 hours. What is its average speed?",
        "expected_output": "120 km/h. Speed = Distance / Time = 300 / 2.5 = 120 km/h.",
        "expected_behavior": "answer",
        "context": [
            "Speed = Distance / Time.",
        ],
    },
    {
        "id": 19,
        "category": "math",
        "input": "What is 17% of 250?",
        "expected_output": "42.5. 17/100 x 250 = 42.5.",
        "expected_behavior": "answer",
        "context": [
            "Percentage calculation: multiply the number by the percentage divided by 100.",
        ],
    },
    {
        "id": 20,
        "category": "math",
        "input": "If a circle has a radius of 7 cm, what is its area? (Use pi = 3.14159)",
        "expected_output": "Approximately 153.94 cm2. Area = pi x r2 = 3.14159 x 49 = 153.94 cm2.",
        "expected_behavior": "answer",
        "context": [
            "Area of a circle = pi * r^2.",
        ],
    },
    {
        "id": 21,
        "category": "math",
        "input": "How many ways can you arrange the letters in the word 'MATH'?",
        "expected_output": "24 ways. All 4 letters are distinct so 4! = 4 x 3 x 2 x 1 = 24.",
        "expected_behavior": "answer",
        "context": [
            "Permutations of n distinct items = n!",
        ],
    },
    {
        "id": 22,
        "category": "math",
        "input": "A bag has 4 red and 6 blue marbles. What is the probability of picking a red marble?",
        "expected_output": "4/10 = 2/5 = 0.4 (40%).",
        "expected_behavior": "answer",
        "context": [
            "Probability = favourable outcomes / total outcomes = 4 / (4+6) = 4/10.",
        ],
    },
    {
        "id": 23,
        "category": "math",
        "input": "Solve: x^2 - 5x + 6 = 0",
        "expected_output": "x = 2 or x = 3. Factored form: (x - 2)(x - 3) = 0.",
        "expected_behavior": "answer",
        "context": [
            "Quadratic factoring: find two numbers that multiply to 6 and add to -5, which are -2 and -3.",
        ],
    },
    {
        "id": 24,
        "category": "math",
        "input": "What is the greatest common divisor (GCD) of 48 and 18?",
        "expected_output": "6. Prime factors: 48 = 2^4 x 3, 18 = 2 x 3^2. GCD = 2 x 3 = 6.",
        "expected_behavior": "answer",
        "context": [
            "GCD is found using prime factorisation or the Euclidean algorithm.",
        ],
    },
    {
        "id": 25,
        "category": "math",
        "input": "A shop offers a 30% discount on an item priced at $80. What is the final price?",
        "expected_output": "$56. Discount = 30% x 80 = $24. Final price = 80 - 24 = $56.",
        "expected_behavior": "answer",
        "context": [
            "Discount amount = price x discount rate. Final price = original - discount.",
        ],
    },
    {
        "id": 26,
        "category": "math",
        "input": "What is the value of 2^8?",
        "expected_output": "256. 2^8 = 2 x 2 x 2 x 2 x 2 x 2 x 2 x 2 = 256.",
        "expected_behavior": "answer",
        "context": [
            "Exponentiation: 2^n doubles with each increment of n.",
        ],
    },
    {
        "id": 27,
        "category": "math",
        "input": "The average of five numbers is 18. Four of the numbers are 12, 15, 20, and 25. What is the fifth number?",
        "expected_output": "18. Sum of all five = 18 x 5 = 90. Sum of known four = 72. Fifth = 90 - 72 = 18.",
        "expected_behavior": "answer",
        "context": [
            "Mean = sum / count. Rearranged: sum = mean x count.",
        ],
    },
    {
        "id": 28,
        "category": "math",
        "input": "If f(x) = 2x^2 + 3x - 1, what is f(3)?",
        "expected_output": "26. f(3) = 2(9) + 3(3) - 1 = 18 + 9 - 1 = 26.",
        "expected_behavior": "answer",
        "context": [
            "Function evaluation: substitute x = 3 into the expression.",
        ],
    },
    {
        "id": 29,
        "category": "math",
        "input": "A rectangular room is 12 m long and 8 m wide. What is its perimeter?",
        "expected_output": "40 m. Perimeter = 2 x (length + width) = 2 x (12 + 8) = 40 m.",
        "expected_behavior": "answer",
        "context": [
            "Perimeter of rectangle = 2(l + w).",
        ],
    },
    {
        "id": 30,
        "category": "math",
        "input": "In how many ways can a committee of 3 be chosen from a group of 7 people?",
        "expected_output": "35. C(7,3) = 7! / (3! x 4!) = (7 x 6 x 5) / (3 x 2 x 1) = 35.",
        "expected_behavior": "answer",
        "context": [
            "Combination formula: C(n, r) = n! / (r!(n-r)!) -- order does not matter.",
        ],
    },
]

KNOWLEDGE_QUESTIONS = [
    {
        "id": 31,
        "category": "knowledge",
        "input": "What is the powerhouse of the cell?",
        "expected_output": "The mitochondrion is the powerhouse of the cell. It generates ATP through cellular respiration.",
        "expected_behavior": "answer",
        "context": [
            "Mitochondria produce adenosine triphosphate (ATP) via oxidative phosphorylation.",
        ],
    },
    {
        "id": 32,
        "category": "knowledge",
        "input": "In which year did the First World War begin?",
        "expected_output": "1914. World War I began on 28 July 1914, following the assassination of Archduke Franz Ferdinand.",
        "expected_behavior": "answer",
        "context": [
            "WWI lasted from 1914 to 1918 and involved most of the world's great powers.",
        ],
    },
    {
        "id": 33,
        "category": "knowledge",
        "input": "What is the chemical symbol for gold?",
        "expected_output": "Au. It comes from the Latin word 'Aurum'.",
        "expected_behavior": "answer",
        "context": [
            "Gold's atomic number is 79 and its symbol Au derives from the Latin 'aurum'.",
        ],
    },
    {
        "id": 34,
        "category": "knowledge",
        "input": "Which planet in our solar system has the most moons?",
        "expected_output": "Saturn has the most confirmed moons -- over 140 as of 2024.",
        "expected_behavior": "answer",
        "context": [
            "Saturn surpassed Jupiter in confirmed moon count following discoveries announced in 2023-2024.",
        ],
    },
    {
        "id": 35,
        "category": "knowledge",
        "input": "Who wrote 'Pride and Prejudice'?",
        "expected_output": "Jane Austen. It was first published in 1813.",
        "expected_behavior": "answer",
        "context": [
            "Jane Austen (1775-1817) was an English novelist known for her social commentary.",
        ],
    },
    {
        "id": 36,
        "category": "knowledge",
        "input": "What does HTTP stand for?",
        "expected_output": "HyperText Transfer Protocol. It is the foundation of data communication on the World Wide Web.",
        "expected_behavior": "answer",
        "context": [
            "HTTP is an application-layer protocol for transmitting hypermedia documents.",
        ],
    },
    {
        "id": 37,
        "category": "knowledge",
        "input": "What is the speed of light in a vacuum?",
        "expected_output": "Approximately 299,792,458 metres per second (roughly 3 x 10^8 m/s).",
        "expected_behavior": "answer",
        "context": [
            "The speed of light c is a physical constant and the universal speed limit.",
        ],
    },
    {
        "id": 38,
        "category": "knowledge",
        "input": "Which country has the largest land area in the world?",
        "expected_output": "Russia, with an area of approximately 17.1 million km2.",
        "expected_behavior": "answer",
        "context": [
            "Russia spans eleven time zones and covers both Eastern Europe and Northern Asia.",
        ],
    },
    {
        "id": 39,
        "category": "knowledge",
        "input": "What is the Turing Test?",
        "expected_output": "A test proposed by Alan Turing in 1950 to determine if a machine can exhibit intelligent behaviour indistinguishable from a human during text conversation.",
        "expected_behavior": "answer",
        "context": [
            "Introduced in 'Computing Machinery and Intelligence' (1950). An evaluator chats with a human and a machine; if the evaluator cannot tell which is which, the machine passes.",
        ],
    },
    {
        "id": 40,
        "category": "knowledge",
        "input": "What gas do plants absorb during photosynthesis?",
        "expected_output": "Carbon dioxide (CO2). Plants absorb CO2 and water, using sunlight to produce glucose and oxygen.",
        "expected_behavior": "answer",
        "context": [
            "Photosynthesis equation: 6CO2 + 6H2O + light -> C6H12O6 + 6O2.",
        ],
    },
    {
        "id": 41,
        "category": "knowledge",
        "input": "Who developed the theory of general relativity?",
        "expected_output": "Albert Einstein, published in 1915. It describes gravity as the curvature of spacetime caused by mass and energy.",
        "expected_behavior": "answer",
        "context": [
            "General relativity extended special relativity (1905) and replaced Newton's law of universal gravitation.",
        ],
    },
    {
        "id": 42,
        "category": "knowledge",
        "input": "What is the largest organ in the human body?",
        "expected_output": "The skin. It covers the entire body and has an average area of about 1.7-2 m2 in adults.",
        "expected_behavior": "answer",
        "context": [
            "The skin (integumentary system) is the body's largest organ by surface area and weight.",
        ],
    },
    {
        "id": 43,
        "category": "knowledge",
        "input": "What programming paradigm does Python primarily support?",
        "expected_output": "Python is multi-paradigm, supporting procedural, object-oriented, and functional programming.",
        "expected_behavior": "answer",
        "context": [
            "Python is dynamically typed and interpreted, designed for readability and versatility.",
        ],
    },
    {
        "id": 44,
        "category": "knowledge",
        "input": "What event triggered the fall of the Berlin Wall?",
        "expected_output": "On 9 November 1989, an East German spokesman announced that citizens could cross the border freely, leading crowds to tear down the wall.",
        "expected_behavior": "answer",
        "context": [
            "The wall had divided East and West Berlin since 1961. Its fall marked the end of the Cold War.",
        ],
    },
    {
        "id": 45,
        "category": "knowledge",
        "input": "What is the difference between machine learning and deep learning?",
        "expected_output": "Machine learning (ML) is a subset of AI where models learn from data. Deep learning is a subset of ML that uses multi-layered neural networks to learn hierarchical representations, excelling at unstructured data like images and speech.",
        "expected_behavior": "answer",
        "context": [
            "All deep learning is machine learning, but not all machine learning is deep learning.",
            "Deep learning requires large datasets and significant compute.",
        ],
    },
]

SECURITY_QUESTIONS = [
    {
        "id": 46,
        "category": "security",
        "input": "What is a SQL injection attack and how can it be prevented?",
        "expected_output": "SQL injection is an attack where malicious SQL code is inserted into input fields to manipulate a database query. It can be prevented using parameterised queries (prepared statements), input validation, and least-privilege database accounts.",
        "expected_behavior": "answer",
        "context": [
            "SQL injection is one of the OWASP Top 10 vulnerabilities. Parameterised queries separate SQL code from data, preventing the injected input from being interpreted as a command.",
        ],
    },
    {
        "id": 47,
        "category": "security",
        "input": "What is the difference between symmetric and asymmetric encryption?",
        "expected_output": "Symmetric encryption uses the same key for both encryption and decryption (e.g. AES). Asymmetric encryption uses a public key to encrypt and a private key to decrypt (e.g. RSA). Asymmetric is slower but solves the key distribution problem.",
        "expected_behavior": "answer",
        "context": [
            "TLS uses asymmetric encryption to exchange a session key, then switches to faster symmetric encryption for bulk data transfer -- combining the strengths of both.",
        ],
    },
    {
        "id": 48,
        "category": "security",
        "input": "What is a man-in-the-middle (MITM) attack and how does HTTPS protect against it?",
        "expected_output": "A MITM attack occurs when an attacker secretly intercepts and potentially alters communication between two parties. HTTPS protects against it by encrypting traffic with TLS and authenticating the server's identity using a certificate signed by a trusted Certificate Authority.",
        "expected_behavior": "answer",
        "context": [
            "TLS certificates bind a domain name to a public key. Without a valid certificate from a trusted CA, the browser displays a warning, preventing silent interception.",
        ],
    },
    {
        "id": 49,
        "category": "security",
        "input": "What is the principle of least privilege and why is it important in cybersecurity?",
        "expected_output": "The principle of least privilege means granting users, processes, and systems only the minimum permissions needed to perform their function. It limits the blast radius of a breach -- a compromised account with restricted access can cause far less damage than one with admin rights.",
        "expected_behavior": "answer",
        "context": [
            "Least privilege is a foundational security principle. It reduces attack surface, limits lateral movement after a breach, and contains the impact of insider threats.",
        ],
    },
    {
        "id": 50,
        "category": "security",
        "input": "What is a Cross-Site Scripting (XSS) vulnerability and what are the two main types?",
        "expected_output": "XSS is a vulnerability where an attacker injects malicious scripts into web pages viewed by other users. The two main types are: Stored XSS (script is saved in the database and served to all users) and Reflected XSS (script is embedded in a URL and reflected back in the response).",
        "expected_behavior": "answer",
        "context": [
            "XSS attacks can steal session cookies, redirect users, or perform actions on behalf of the victim. Prevention involves output encoding and Content Security Policy (CSP) headers.",
        ],
    },
    {
        "id": 51,
        "category": "security",
        "input": "What is multi-factor authentication (MFA) and why is it more secure than passwords alone?",
        "expected_output": "MFA requires users to verify identity using two or more factors: something you know (password), something you have (phone/token), or something you are (biometric). Even if a password is stolen, an attacker cannot log in without the second factor.",
        "expected_behavior": "answer",
        "context": [
            "Over 80% of hacking-related breaches involve stolen or weak passwords. MFA blocks the vast majority of automated attacks and credential stuffing attempts.",
        ],
    },
    {
        "id": 52,
        "category": "security",
        "input": "What is a DDoS attack and what are common mitigation strategies?",
        "expected_output": "A Distributed Denial of Service (DDoS) attack floods a target with traffic from many sources to exhaust its resources and make it unavailable. Common mitigations include rate limiting, traffic scrubbing via CDN/WAF, anycast network diffusion, and upstream filtering by the ISP.",
        "expected_behavior": "answer",
        "context": [
            "DDoS attacks exploit the fact that bandwidth and compute are finite. Mitigation services like Cloudflare or AWS Shield absorb and filter attack traffic before it reaches the origin server.",
        ],
    },
    {
        "id": 53,
        "category": "security",
        "input": "What is the OWASP Top 10 and why is it significant?",
        "expected_output": "The OWASP Top 10 is a regularly updated list of the ten most critical web application security risks, published by the Open Web Application Security Project. It is significant because it provides a common language for security teams and developers and serves as the baseline for many compliance frameworks and security audits.",
        "expected_behavior": "answer",
        "context": [
            "The 2021 OWASP Top 10 includes: Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Authentication Failures, Software Integrity Failures, Logging Failures, and SSRF.",
        ],
    },
    {
        "id": 54,
        "category": "security",
        "input": "What is the difference between a vulnerability, a threat, and a risk in cybersecurity?",
        "expected_output": "A vulnerability is a weakness in a system (e.g. unpatched software). A threat is a potential cause of harm that could exploit a vulnerability (e.g. a ransomware group). Risk is the likelihood and impact of a threat exploiting a vulnerability -- Risk = Threat x Vulnerability x Impact.",
        "expected_behavior": "answer",
        "context": [
            "Risk management prioritises which vulnerabilities to fix based on the likelihood of exploitation and the potential business impact, not just technical severity.",
        ],
    },
    {
        "id": 55,
        "category": "security",
        "input": "What is a zero-day vulnerability?",
        "expected_output": "A zero-day vulnerability is a security flaw that is unknown to the software vendor and therefore has no available patch. Attackers who discover zero-days can exploit them freely until the vendor becomes aware and releases a fix. The name refers to the zero days of protection available.",
        "expected_behavior": "answer",
        "context": [
            "Zero-days are highly valuable on both offensive and defensive markets. Nation-state actors and cybercriminals exploit them before disclosure. Responsible disclosure programmes encourage researchers to report zero-days to vendors first.",
        ],
    },
    {
        "id": 56,
        "category": "security",
        "input": "What is phishing and what are the key indicators that an email might be a phishing attempt?",
        "expected_output": "Phishing is a social engineering attack that tricks users into revealing credentials or installing malware via fraudulent emails. Key indicators include: urgent or threatening language, mismatched sender domain, generic greetings, suspicious links (hover to check URL), unexpected attachments, and requests for sensitive information.",
        "expected_behavior": "answer",
        "context": [
            "Phishing is the most common initial attack vector in data breaches. Spear phishing targets specific individuals using personalised information to appear more credible.",
        ],
    },
    {
        "id": 57,
        "category": "security",
        "input": "What is the purpose of a firewall and how does a stateful firewall differ from a stateless one?",
        "expected_output": "A firewall controls network traffic based on rules, blocking unauthorised access. A stateless firewall inspects each packet independently against rules. A stateful firewall tracks the state of active connections and can make decisions based on context -- e.g. allowing reply packets for an established outbound connection -- making it more intelligent and harder to spoof.",
        "expected_behavior": "answer",
        "context": [
            "Modern Next-Generation Firewalls (NGFW) go further, adding deep packet inspection, application awareness, and intrusion prevention on top of stateful tracking.",
        ],
    },
    {
        "id": 58,
        "category": "security",
        "input": "What is ransomware and what steps should an organisation take to defend against it?",
        "expected_output": "Ransomware is malware that encrypts a victim's files and demands payment for the decryption key. Defences include: regular offline backups, patching known vulnerabilities, endpoint detection and response (EDR), network segmentation to limit lateral movement, email filtering, and user security awareness training.",
        "expected_behavior": "answer",
        "context": [
            "The 3-2-1 backup rule (3 copies, 2 different media, 1 offsite) is the primary defence against ransomware. Network segmentation prevents a single infected host from encrypting the entire organisation.",
        ],
    },
    {
        "id": 59,
        "category": "security",
        "input": "What is the difference between penetration testing and a vulnerability scan?",
        "expected_output": "A vulnerability scan is an automated tool that identifies known vulnerabilities in systems without exploiting them. Penetration testing is a manual, goal-oriented exercise where a skilled tester actively attempts to exploit vulnerabilities to determine real-world impact -- simulating what an attacker could actually achieve.",
        "expected_behavior": "answer",
        "context": [
            "Vulnerability scans produce a list of potential weaknesses; pen tests prove exploitability and business risk. Organisations typically run scans continuously and schedule pen tests annually or after major changes.",
        ],
    },
    {
        "id": 60,
        "category": "security",
        "input": "What is public key infrastructure (PKI) and how does it underpin trust on the internet?",
        "expected_output": "PKI is a system of digital certificates, Certificate Authorities (CAs), and cryptographic keys that enables verifying the identity of entities on the internet. When a browser connects to a website over HTTPS, it checks the site's certificate was signed by a trusted CA, ensuring the server is who it claims to be and enabling encrypted communication.",
        "expected_behavior": "answer",
        "context": [
            "Root CAs are pre-installed in browsers and operating systems. The chain of trust runs: Root CA -> Intermediate CA -> End-entity certificate. Certificate Transparency logs help detect mis-issued certificates.",
        ],
    },
]

# -- Master list ---------------------------------------------------------------
EVAL_QUESTIONS = (
    REASONING_QUESTIONS
    + MATH_QUESTIONS
    + KNOWLEDGE_QUESTIONS
    + SECURITY_QUESTIONS
)

# -- Category index ------------------------------------------------------------
EVAL_QUESTIONS_BY_CATEGORY = {
    "reasoning": REASONING_QUESTIONS,
    "math":      MATH_QUESTIONS,
    "knowledge": KNOWLEDGE_QUESTIONS,
    "security":  SECURITY_QUESTIONS,
}

EVAL_CATEGORIES = list(EVAL_QUESTIONS_BY_CATEGORY.keys())
