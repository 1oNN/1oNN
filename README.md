<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=26&duration=3200&pause=900&color=6C8EBF&center=true&vCenter=true&width=760&lines=Hi%2C+I'm+Hammad+Ahmad;AI+%2F+Machine+Learning+Engineer;Semantic+Search+%C2%B7+LLMs+%C2%B7+RAG;I+build+retrieval+systems+that+cite+their+sources" alt="AI / Machine Learning Engineer: Semantic Search, LLMs, RAG" />

**MSc Applied Artificial Intelligence & Data Analytics (Merit)** · University of Bradford<br>
Bradford, UK · open to relocation

<br>

<a href="https://hammadahmad.co.uk"><img src="https://img.shields.io/badge/Portfolio-hammadahmad.co.uk-1a1a1a?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Portfolio" /></a>
<a href="https://hammadahmad.co.uk/projects"><img src="https://img.shields.io/badge/Case%20studies-Read-6C8EBF?style=for-the-badge" alt="Case studies" /></a>
<a href="https://hammadahmad.co.uk/cv/Hammad_Ahmad_CV_AI_ML_Engineer.pdf"><img src="https://img.shields.io/badge/CV-Download-4C566A?style=for-the-badge" alt="CV" /></a>
<a href="https://jobzyl.com"><img src="https://img.shields.io/badge/Jobzyl-Live-3FCF8E?style=for-the-badge" alt="Jobzyl, live" /></a>
<a href="https://www.linkedin.com/in/hammadahmad123"><img src="https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
<a href="mailto:hammadahmad.ml@gmail.com"><img src="https://img.shields.io/badge/Email-Say%20hello-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Email" /></a>
<a href="https://orcid.org/0009-0000-7873-4977"><img src="https://img.shields.io/badge/ORCID-0009--0000--7873--4977-A6CE39?style=for-the-badge&logo=orcid&logoColor=white" alt="ORCID" /></a>
<a href="https://doi.org/10.1007/978-3-031-66854-8_1"><img src="https://img.shields.io/badge/Publication-Springer-0B7285?style=for-the-badge&logo=springer&logoColor=white" alt="Springer publication" /></a>

</div>

---

## About

I build **semantic search and retrieval systems that stay honest about what they know**, benchmark predictive models on large real-world datasets, and take both to production: retrieval design, backend APIs, deployment.

- 🔎 Currently: founder and sole engineer of **[Jobzyl](https://jobzyl.com)**, a live job search aggregator over **29 integrated sources** and a **3.4M row** Postgres index across 26 countries, with semantic CV-to-posting matching in pgvector. Gated so a posting naming no recognised skill reports as too thin to score rather than as a confident 0%.
- 🔬 Most recent research: **FinLaw-UK**, a graph-augmented RAG system over UK financial regulation where every citation is resolved against a Neo4j knowledge graph before it reaches the user, and the system refuses rather than answering when retrieval is weak.
- 🧾 Re-measured my own evaluation pipeline post-submission, found two reported metrics were regex shape-checks rather than correctness measures, and **published the correction** alongside the true graph-verified rate. The [measurement-integrity section](https://github.com/1oNN/finlaw-uk#measurement-integrity) is above the fold in the repo, not in an appendix.
- ⚙️ Shipped an AI voice-agent platform that handled **2,100+ outbound calls** and cut mean call latency **54%** (2.4s → 1.1s).
- 📄 First-author and corresponding-author on a **peer-reviewed Springer publication** (ICSMAI 2024, Morocco).
- 🧪 Benchmarked **11 classifiers over 253,680 CDC BRFSS records** for diabetes risk, with resampling confined to the training folds.
- 🎯 Currently open to **AI/ML engineering roles and funded doctoral positions** in the UK and EU.

---

## Featured work

<table>
<tr>
<td colspan="2" valign="top">

### 🔎 Jobzyl · [jobzyl.com](https://jobzyl.com)

**Live job-search aggregator over a 3.4M row index spanning 26 countries.** 29 integrated sources: 23 job boards (Indeed, Adzuna, Reed) plus 6 ATS platforms read directly, so a company's own careers board is a source rather than an aggregator's copy of it. Parallel fan-out with per-source timeout isolation, streamed back over SSE. Semantic CV-to-posting matching on 384-dimension multilingual embeddings in pgvector, keyword ATS scoring that parses the CV in the browser and uploads nothing, and a Claude layer for scoring, cover letters and interview prep behind prompt-injection defences and per-user quotas. Ranking is a weighted Postgres full-text function, rebuilt after measuring that 27.4% of results carried none of the query terms in the title. 1,950 tests, 11 CI build gates, RLS on all 23 tables.

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/-Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/-React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Python](https://img.shields.io/badge/-Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![AWS](https://img.shields.io/badge/-AWS-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white)

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🏛️ [FinLaw-UK](https://github.com/1oNN/finlaw-uk)
**Graph-augmented RAG over UK financial regulation**

[![Stars](https://img.shields.io/github/stars/1oNN/finlaw-uk?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/finlaw-uk/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/1oNN/finlaw-uk?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/finlaw-uk/commits)
[![License](https://img.shields.io/github/license/1oNN/finlaw-uk?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/finlaw-uk/blob/main/LICENSE)

Hybrid BM25 + BGE-small retrieval with reciprocal rank fusion, 2-hop Neo4j traversal, and Mistral 7B-Instruct served locally via Ollama. Every citation is resolved against the graph before the answer ships; provisions absent from it are flagged rather than passed through.

![Python](https://img.shields.io/badge/-Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Neo4j](https://img.shields.io/badge/-Neo4j-4581C3?style=flat-square&logo=neo4j&logoColor=white)
![Ollama](https://img.shields.io/badge/-Ollama-000000?style=flat-square&logo=ollama&logoColor=white)
![FastAPI](https://img.shields.io/badge/-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Flask](https://img.shields.io/badge/-Flask-000000?style=flat-square&logo=flask&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

`0.76` RAGAS faithfulness, `0.74` answer relevance, and `0.68` legal completeness: the figures stable across both evaluation tracks and both scoring implementations.<br>
*110-item harness, 10 curated items · MSc dissertation*

</td>
<td width="50%" valign="top">

### 🎙️ [VoiceFlow](https://github.com/1oNN/VoiceFlow)
**Secure Speech Transcription Pipeline**

[![Stars](https://img.shields.io/github/stars/1oNN/VoiceFlow?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/VoiceFlow/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/1oNN/VoiceFlow?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/VoiceFlow/commits)

Engineered a secure call-export pipeline for Retell AI outbound voice agents, ensuring zero-trust data privacy by transcribing sensitive customer recordings locally via an open-source Whisper large-v3 model.

![Python](https://img.shields.io/badge/-Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/-PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)
![Whisper](https://img.shields.io/badge/-Whisper-412991?style=flat-square&logo=openai&logoColor=white)
![Next.js](https://img.shields.io/badge/-Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)

Multi-threaded async fetching · Live SSE progress<br>
*Processed 2,100+ production calls*

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🩺 [DiabetesSense](https://github.com/1oNN/diabetes-app)
**11-classifier benchmark + screening tool**

[![Stars](https://img.shields.io/github/stars/1oNN/diabetes-app?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/diabetes-app/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/1oNN/diabetes-app?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/diabetes-app/commits)

Diabetes risk on CDC BRFSS 2015, comparing random over-sampling, SMOTE and ADASYN with resampling confined to the training folds. Shipped as a lab-free, 19-question screening app.

![scikit-learn](https://img.shields.io/badge/-scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white)
![pandas](https://img.shields.io/badge/-pandas-150458?style=flat-square&logo=pandas&logoColor=white)
![Flask](https://img.shields.io/badge/-Flask-000000?style=flat-square&logo=flask&logoColor=white)
![React](https://img.shields.io/badge/-React-61DAFB?style=flat-square&logo=react&logoColor=black)

Random Forest best on ROC-AUC and sensitivity<br>
`253,680` records · `14%` positive class<br>
*Flask + React*

</td>
<td width="50%" valign="top">

### 😴 [sleep-efficiency-app](https://github.com/1oNN/sleep-efficiency-app)
**The model behind my ICSMAI 2024 paper**

[![Stars](https://img.shields.io/github/stars/1oNN/sleep-efficiency-app?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/sleep-efficiency-app/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/1oNN/sleep-efficiency-app?style=flat-square&labelColor=1a1a1a&color=6C8EBF)](https://github.com/1oNN/sleep-efficiency-app/commits)

Four regression models compared, winner served behind a Flask form.

![scikit-learn](https://img.shields.io/badge/-scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white)
![NumPy](https://img.shields.io/badge/-NumPy-013243?style=flat-square&logo=numpy&logoColor=white)
![Flask](https://img.shields.io/badge/-Flask-000000?style=flat-square&logo=flask&logoColor=white)

Random Forest `R² 0.8569` (MSE 0.0027)<br>
*First-author, corresponding author*

</td>
</tr>
</table>

<div align="center">

**Full case studies, with architecture diagrams and the decisions behind them → [hammadahmad.co.uk/projects](https://hammadahmad.co.uk/projects)**

</div>

---

## Publication

> **Ahmad, H.** *(first & corresponding author)*, Khan, M.U., Azam, M. (2024).<br>
> **Comparative Analysis of Machine Learning Methods for Enhancing Sleep Efficiency and Prediction.**<br>
> In: Serrhini, M., Ghoumid, K. (eds) *Advances in Smart Medical, IoT & Artificial Intelligence*, ICSMAI 2024.<br>
> Information Systems Engineering and Management, vol 12, pp. 3-15. Springer, Cham.<br>
> Presented at ICSMAI 2024, Saidia, Morocco, 18-20 April 2024.<br>
> **DOI:** [10.1007/978-3-031-66854-8_1](https://doi.org/10.1007/978-3-031-66854-8_1)

**Software & data release.** The FinLaw-UK implementation and its evaluation harness are open under MIT at [github.com/1oNN/finlaw-uk](https://github.com/1oNN/finlaw-uk): a 110-item UK financial-regulation QA structure spanning factual questions, document tasks and case scenarios, of which **10 items are fully curated with gold answers and required citations** and are the meaningful evaluation set. The remaining rows are template stubs and are documented as such in the repo's known limitations.

---

## Tech stack

<div align="center">

**Machine learning & data**

[![ML stack](https://skillicons.dev/icons?i=pytorch,sklearn,py&perline=6)](https://skillicons.dev)

![XGBoost](https://img.shields.io/badge/XGBoost-1B7A3D?style=flat-square)
![pandas](https://img.shields.io/badge/pandas-150458?style=flat-square&logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Sentence%20Transformers-FFD21E?style=flat-square&logo=huggingface&logoColor=black)

<br>

**Retrieval & knowledge**

![RAG](https://img.shields.io/badge/RAG-6C8EBF?style=flat-square)
![Semantic search](https://img.shields.io/badge/Semantic%20search-6C8EBF?style=flat-square)
![pgvector](https://img.shields.io/badge/pgvector-6C8EBF?style=flat-square)
![fastembed](https://img.shields.io/badge/fastembed%20%28ONNX%29-6C8EBF?style=flat-square)
![Hybrid retrieval](https://img.shields.io/badge/BM25%20%2B%20Dense-6C8EBF?style=flat-square)
![Cross-encoder](https://img.shields.io/badge/Cross--encoder%20re--ranking-6C8EBF?style=flat-square)
![RAGAS](https://img.shields.io/badge/RAGAS-6C8EBF?style=flat-square)
![Neo4j](https://img.shields.io/badge/Neo4j-4581C3?style=flat-square&logo=neo4j&logoColor=white)
![Claude API](https://img.shields.io/badge/Anthropic%20Claude%20API-D97757?style=flat-square&logo=anthropic&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat-square&logo=ollama&logoColor=white)

<br>

**Engineering**

[![Engineering stack](https://skillicons.dev/icons?i=py,ts,fastapi,flask,react,nextjs&perline=8)](https://skillicons.dev)

![PL/pgSQL](https://img.shields.io/badge/PL%2FpgSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![asyncio](https://img.shields.io/badge/asyncio-3776AB?style=flat-square&logo=python&logoColor=white)

<br>

**Infrastructure & quality**

[![Infra stack](https://skillicons.dev/icons?i=postgres,supabase,docker,aws,linux,git&perline=8)](https://skillicons.dev)

![Oracle Cloud](https://img.shields.io/badge/Oracle%20Cloud-C74634?style=flat-square&logo=oracle&logoColor=white)
![pytest](https://img.shields.io/badge/pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![Sentry](https://img.shields.io/badge/Sentry-362D59?style=flat-square&logo=sentry&logoColor=white)

</div>

---

## GitHub

<div align="center">

<!-- Generated daily by .github/workflows/cards.yml; served from this repo so it can't rate-limit -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/1oNN/1oNN/main/metrics-dark.svg" />
  <img src="https://raw.githubusercontent.com/1oNN/1oNN/main/metrics.svg" alt="GitHub metrics" width="47%" />
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/1oNN/1oNN/main/metrics.languages-dark.svg" />
  <img src="https://raw.githubusercontent.com/1oNN/1oNN/main/metrics.languages.svg" alt="Most used languages" width="47%" />
</picture>

<br><br>

<!-- GitHub Contribution Snake -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/1oNN/1oNN/output/github-snake-dark.svg" />
  <img src="https://raw.githubusercontent.com/1oNN/1oNN/output/github-snake.svg" alt="Contribution graph" width="100%" />
</picture>

</div>

---

## Experience

<details open>
<summary><b>Founder & Sole Engineer</b> · Jobzyl · Apr 2026 - Present · Bradford, UK</summary>

<br>

Build and operate [jobzyl.com](https://jobzyl.com) end to end: **29 provider integrations** and **6 applicant tracking systems**, a **3.4M row** Postgres index across 26 countries, FastAPI backend, Next.js frontend and AWS deploy pipeline.

- Shipped semantic CV-to-posting matching in production: 384-dimension multilingual sentence embeddings over pgvector against the full corpus, gated so a posting naming no recognised skill reports as too thin to score rather than a confident 0%
- Built the LLM layer on Anthropic Claude (CV scoring, cover letter, interview prep), with prompt-injection defences on every call, per-user quotas and documented fail-open behaviour
- Trained a pay regression model against the shipped salary benchmark as baseline, split by employer group to prevent leakage: MAE 27,420 to 24,001, MdAPE 18.9% to 16.4%. Reported per country and seniority, and held back from deployment
- Rebuilt search ranking as a weighted Postgres full-text function with a title-relevance layer, after measuring that 27.4% of returned results had none of the user's query terms in the job title
- Hardened the platform: Fernet field encryption of CV text, row-level security across 23 tables, GDPR export and deletion, behind **1,950 automated tests** and 11 CI build gates

</details>

<details>
<summary><b>AI / Machine Learning Engineer</b> · Outlyst · Oct 2025 - Mar 2026 · Leeds, UK / Remote</summary>

<br>

*Fixed-term contract.* Built and deployed an AI voice-agent system for outbound calling (Retell AI, FastAPI): backend dialogue-flow logic, automated call flows, lead-qualification rules, gatekeeper detection and callback scheduling.

- Handled **2,100+ calls** and cut manual calling workload by roughly **50%**
- Profiled async I/O and connection pooling to reduce mean call latency **54%** (2.4s → 1.1s)
- Built an internal micro-CRM for lead tracking, removing external CRM licensing costs
- Built [VoiceFlow](https://github.com/1oNN/VoiceFlow), a FastAPI service running Whisper large-v3 in-process over the 2,100+ call recordings, threading each export to keep blocking downloads and torch inference off the asyncio event loop

</details>

<details>
<summary><b>Research Assistant | Graph-Augmented LLM Engineering</b> · University of Bradford · Jan 2025 - Sep 2025</summary>

<br>

Designed and evaluated **FinLaw-UK**: Mistral 7B served locally via Ollama, paired with a Neo4j knowledge graph, over the FCA Handbook, PRA Rulebook, FRC standards and statutory sources.

- Engineered the retrieval pipeline: clause-level segmentation, Sentence Transformer embeddings, BM25 + dense fusion by reciprocal rank fusion, cross-encoder re-ranking, and graph-grounded citation verification
- Built the evaluation harness, extending RAGAS with a custom legal-completeness metric that reproduces at 0.68 across both evaluation tracks
- Re-measured the submitted evaluation post-hoc, established that two reported metrics were format checks rather than correctness measures, and published the correction with the code
- Supervised by Dr Tillal Eldabi and Dr Irfan Mehmood

</details>

<details>
<summary><b>Research Intern, Data Science</b> · COMSATS University Islamabad · Jul 2023 - Jul 2024</summary>

<br>

Benchmarked **11 classifiers** for diabetes risk on 253,680 CDC BRFSS records, comparing random over-sampling against SMOTE and ADASYN for the 86/14 class imbalance, with resampling confined to the training folds.

- Analysed 20+ demographic, lifestyle and clinical indicators: age, general health, BMI, blood pressure and income emerged as the strongest correlates
- Deployed the winning model behind a REST API with SHAP-based interpretability
- Led the first-author comparative study of sleep-efficiency prediction published at ICSMAI 2024

</details>

---

## Education

<details>
<summary><b>MSc, Applied Artificial Intelligence & Data Analytics (Merit)</b> · University of Bradford · 2024-2025</summary>

<br>

**Dissertation:** *FinLaw-UK: A Graph-Augmented Retrieval Chatbot for Reliable and Transparent UK Financial Regulation*

Modules included Artificial Intelligence and Data Science (79), Business Data Analytics (79), and Responsible AI: Ethics, Law and Governance (75).

</details>

<details>
<summary><b>BS, Bioinformatics</b> · COMSATS University Islamabad · 2020-2024</summary>

<br>

**Thesis:** *AI-Assisted Analysis and Prediction of At-Risk Diabetic Individuals*, graded A.

</details>

---

**Research interests**<br>
`semantic search at scale` · `graph-augmented retrieval` · `LLM faithfulness evaluation` · `evaluation methodology for RAG` · `interpretable clinical modelling`

**Languages**<br>
English (IELTS 7.0, CEFR C1) · Urdu (native) · German (A1.2)

**Right to work**<br>
UK Graduate visa to December 2027. Eligible to work now, no sponsorship required.

---

<div align="center">

### Let's talk

If you're working on retrieval, evaluation, or anything where a model needs to show its sources, I'd like to hear about it.

<a href="mailto:hammadahmad.ml@gmail.com"><img src="https://img.shields.io/badge/hammadahmad.ml@gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Email" /></a>
<a href="https://www.linkedin.com/in/hammadahmad123"><img src="https://img.shields.io/badge/in/hammadahmad123-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
<a href="https://hammadahmad.co.uk"><img src="https://img.shields.io/badge/hammadahmad.co.uk-1a1a1a?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Website" /></a>

<br><br>

<img src="https://komarev.com/ghpvc/?username=1oNN&style=flat-square&color=6C8EBF&label=Profile+views" alt="Profile views" />

</div>
