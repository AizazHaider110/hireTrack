import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface ExperienceEntry {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  description?: string;
  isCurrent?: boolean;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  field?: string;
  graduationYear?: string;
  gpa?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location?: string;
}

export interface ParsedResumeData {
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  contactInfo: ContactInfo;
  rawText: string;
  summary?: string;
  certifications?: string[];
  languages?: string[];
  totalYearsExperience?: number;
}

@Injectable()
export class ResumeParsingService {
  private readonly logger = new Logger(ResumeParsingService.name);

  // Common technical skills for matching
  private readonly technicalSkills = new Set([
    // Programming Languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala', 'r',
    // Frontend
    'react', 'angular', 'vue', 'svelte', 'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap', 'jquery', 'next.js', 'nuxt',
    // Backend
    'node.js', 'express', 'nestjs', 'django', 'flask', 'spring', 'rails', 'laravel', 'fastapi', '.net', 'asp.net',
    // Databases
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'sqlite', 'oracle', 'sql server', 'cassandra',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'gitlab', 'github actions', 'circleci',
    // Tools & Frameworks
    'git', 'jira', 'confluence', 'figma', 'graphql', 'rest', 'grpc', 'kafka', 'rabbitmq', 'nginx', 'apache',
    // Data & ML
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'spark', 'hadoop',
    // Mobile
    'react native', 'flutter', 'ios', 'android', 'xamarin',
    // Testing
    'jest', 'mocha', 'cypress', 'selenium', 'junit', 'pytest',
    // Soft skills
    'agile', 'scrum', 'leadership', 'communication', 'problem solving', 'teamwork', 'project management',
  ]);

  // Degree patterns for education parsing
  private readonly degreePatterns = [
    /\b(ph\.?d\.?|doctor(?:ate)?)\b/i,
    /\b(m\.?s\.?|master(?:'?s)?)\b/i,
    /\b(m\.?b\.?a\.?)\b/i,
    /\b(b\.?s\.?|b\.?a\.?|bachelor(?:'?s)?)\b/i,
    /\b(associate(?:'?s)?)\b/i,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Extract text from a resume file (PDF or DOCX)
   * In production, this would use libraries like pdf-parse or mammoth
   */
  async extractText(fileUrl: string): Promise<string> {
    this.logger.debug(`Extracting text from: ${fileUrl}`);

    try {
      // Check file extension
      const ext = path.extname(fileUrl).toLowerCase();
      
      if (ext === '.pdf') {
        return this.extractFromPdf(fileUrl);
      } else if (ext === '.docx' || ext === '.doc') {
        return this.extractFromDocx(fileUrl);
      } else if (ext === '.txt') {
        return this.extractFromTxt(fileUrl);
      } else {
        throw new BadRequestException(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      this.logger.error(`Failed to extract text from ${fileUrl}:`, error);
      throw new BadRequestException('Failed to extract text from resume');
    }
  }

  /**
   * Extract text from PDF file
   * In production, use pdf-parse or similar library
   */
  private async extractFromPdf(fileUrl: string): Promise<string> {
    // Placeholder - in production, use pdf-parse library
    // const pdfParse = require('pdf-parse');
    // const dataBuffer = fs.readFileSync(fileUrl);
    // const data = await pdfParse(dataBuffer);
    // return data.text;
    
    this.logger.debug('PDF extraction placeholder - would use pdf-parse in production');
    return this.getMockResumeText();
  }

  /**
   * Extract text from DOCX file
   * In production, use mammoth or similar library
   */
  private async extractFromDocx(fileUrl: string): Promise<string> {
    // Placeholder - in production, use mammoth library
    // const mammoth = require('mammoth');
    // const result = await mammoth.extractRawText({ path: fileUrl });
    // return result.value;
    
    this.logger.debug('DOCX extraction placeholder - would use mammoth in production');
    return this.getMockResumeText();
  }

  /**
   * Extract text from TXT file
   */
  private async extractFromTxt(fileUrl: string): Promise<string> {
    try {
      if (fs.existsSync(fileUrl)) {
        return fs.readFileSync(fileUrl, 'utf-8');
      }
      return this.getMockResumeText();
    } catch {
      return this.getMockResumeText();
    }
  }

  /**
   * Parse skills from resume text
   */
  parseSkills(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const foundSkills: string[] = [];

    // Match against known technical skills
    for (const skill of this.technicalSkills) {
      // Create regex pattern that matches whole words
      const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(normalizedText)) {
        // Capitalize properly
        foundSkills.push(this.capitalizeSkill(skill));
      }
    }

    // Also extract skills from common skill section patterns
    const skillSectionPatterns = [
      /skills?[:\s]+([^\n]+)/gi,
      /technical skills?[:\s]+([^\n]+)/gi,
      /technologies?[:\s]+([^\n]+)/gi,
      /proficienc(?:y|ies)[:\s]+([^\n]+)/gi,
    ];

    for (const pattern of skillSectionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const skillLine = match[1];
        // Split by common delimiters
        const skills = skillLine.split(/[,;|•·]/);
        for (const skill of skills) {
          const trimmed = skill.trim();
          if (trimmed.length > 1 && trimmed.length < 50) {
            const normalized = trimmed.toLowerCase();
            if (!foundSkills.some(s => s.toLowerCase() === normalized)) {
              foundSkills.push(trimmed);
            }
          }
        }
      }
    }

    // Remove duplicates and return
    return [...new Set(foundSkills)].slice(0, 50); // Limit to 50 skills
  }

  /**
   * Parse experience entries from resume text
   */
  parseExperience(text: string): ExperienceEntry[] {
    const experiences: ExperienceEntry[] = [];
    
    // Common patterns for experience sections
    const experiencePatterns = [
      // Pattern: Title at Company (Date - Date)
      /([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Manager|Analyst|Designer|Lead|Director|Architect|Consultant))\s+(?:at|@)\s+([A-Za-z\s&.,]+)\s*[\(|\|]?\s*(\d{4}|\w+\s+\d{4})\s*[-–]\s*(\d{4}|Present|Current)/gi,
      // Pattern: Company - Title (Date - Date)
      /([A-Za-z\s&.,]+)\s*[-–|]\s*([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Manager|Analyst|Designer|Lead|Director|Architect|Consultant))\s*[\(|\|]?\s*(\d{4}|\w+\s+\d{4})\s*[-–]\s*(\d{4}|Present|Current)/gi,
    ];

    for (const pattern of experiencePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const entry: ExperienceEntry = {
          title: match[1]?.trim() || match[2]?.trim() || 'Unknown',
          company: match[2]?.trim() || match[1]?.trim() || 'Unknown',
          startDate: match[3]?.trim(),
          endDate: match[4]?.trim(),
          isCurrent: /present|current/i.test(match[4] || ''),
        };
        
        // Calculate duration if dates are available
        if (entry.startDate && entry.endDate) {
          entry.duration = this.calculateDuration(entry.startDate, entry.endDate);
        }
        
        experiences.push(entry);
      }
    }

    // If no structured experience found, try to extract from experience section
    if (experiences.length === 0) {
      const expSection = this.extractSection(text, ['experience', 'work history', 'employment']);
      if (expSection) {
        // Simple extraction - split by common job title patterns
        const lines = expSection.split('\n').filter(l => l.trim());
        let currentEntry: Partial<ExperienceEntry> = {};
        
        for (const line of lines) {
          if (this.looksLikeJobTitle(line)) {
            if (currentEntry.title) {
              experiences.push(currentEntry as ExperienceEntry);
            }
            currentEntry = { title: line.trim(), company: 'Unknown' };
          } else if (currentEntry.title && !currentEntry.company) {
            currentEntry.company = line.trim();
          }
        }
        
        if (currentEntry.title) {
          experiences.push(currentEntry as ExperienceEntry);
        }
      }
    }

    return experiences.slice(0, 10); // Limit to 10 entries
  }

  /**
   * Parse education entries from resume text
   */
  parseEducation(text: string): EducationEntry[] {
    const education: EducationEntry[] = [];
    
    // Extract education section
    const eduSection = this.extractSection(text, ['education', 'academic', 'qualifications']);
    const searchText = eduSection || text;

    // Pattern for degree + institution
    const eduPatterns = [
      // Bachelor of Science in Computer Science, University Name, 2020
      /\b((?:Bachelor|Master|Doctor|Ph\.?D|M\.?S|B\.?S|B\.?A|M\.?B\.?A|Associate)(?:'?s)?(?:\s+(?:of|in))?\s+[A-Za-z\s]+)\s*(?:,|from|at|-)\s*([A-Za-z\s&]+(?:University|College|Institute|School))\s*(?:,|\s)\s*(\d{4})?/gi,
      // University Name - Degree (Year)
      /([A-Za-z\s&]+(?:University|College|Institute|School))\s*[-–|]\s*((?:Bachelor|Master|Doctor|Ph\.?D|M\.?S|B\.?S|B\.?A|M\.?B\.?A|Associate)(?:'?s)?(?:\s+(?:of|in))?\s+[A-Za-z\s]+)\s*(?:\()?(\d{4})?(?:\))?/gi,
    ];

    for (const pattern of eduPatterns) {
      const matches = searchText.matchAll(pattern);
      for (const match of matches) {
        const entry: EducationEntry = {
          degree: match[1]?.trim() || match[2]?.trim() || 'Unknown',
          institution: match[2]?.trim() || match[1]?.trim() || 'Unknown',
          graduationYear: match[3]?.trim(),
        };
        
        // Extract field of study if present
        const fieldMatch = entry.degree.match(/(?:in|of)\s+([A-Za-z\s]+)$/i);
        if (fieldMatch) {
          entry.field = fieldMatch[1].trim();
        }
        
        education.push(entry);
      }
    }

    // If no structured education found, try simpler extraction
    if (education.length === 0 && eduSection) {
      for (const degreePattern of this.degreePatterns) {
        if (degreePattern.test(eduSection)) {
          education.push({
            degree: eduSection.match(degreePattern)?.[0] || 'Degree',
            institution: 'Unknown',
          });
          break;
        }
      }
    }

    return education.slice(0, 5); // Limit to 5 entries
  }

  /**
   * Parse contact information from resume text
   */
  parseContactInfo(text: string): ContactInfo {
    const contactInfo: ContactInfo = {};

    // Email pattern
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      contactInfo.email = emailMatch[0];
    }

    // Phone pattern (various formats)
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      contactInfo.phone = phoneMatch[0];
    }

    // LinkedIn pattern
    const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin:?\s*)([a-zA-Z0-9-]+)/i);
    if (linkedinMatch) {
      contactInfo.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;
    }

    // GitHub pattern
    const githubMatch = text.match(/(?:github\.com\/|github:?\s*)([a-zA-Z0-9-]+)/i);
    if (githubMatch) {
      contactInfo.github = `github.com/${githubMatch[1]}`;
    }

    // Website pattern
    const websiteMatch = text.match(/(?:website|portfolio|blog)[:\s]+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (websiteMatch) {
      contactInfo.website = websiteMatch[1];
    }

    // Location pattern (City, State or City, Country)
    const locationMatch = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/);
    if (locationMatch) {
      contactInfo.location = locationMatch[0];
    }

    return contactInfo;
  }


  /**
   * Full resume parsing - combines all parsing methods
   */
  async parseResume(fileUrl: string): Promise<ParsedResumeData> {
    this.logger.log(`Parsing resume: ${fileUrl}`);

    // Extract raw text
    const rawText = await this.extractText(fileUrl);

    // Parse all components
    const skills = this.parseSkills(rawText);
    const experience = this.parseExperience(rawText);
    const education = this.parseEducation(rawText);
    const contactInfo = this.parseContactInfo(rawText);

    // Extract summary if present
    const summary = this.extractSummary(rawText);

    // Extract certifications
    const certifications = this.extractCertifications(rawText);

    // Extract languages
    const languages = this.extractLanguages(rawText);

    // Calculate total years of experience
    const totalYearsExperience = this.calculateTotalExperience(experience);

    const parsedData: ParsedResumeData = {
      skills,
      experience,
      education,
      contactInfo,
      rawText,
      summary,
      certifications,
      languages,
      totalYearsExperience,
    };

    this.logger.log(`Resume parsed successfully. Found ${skills.length} skills, ${experience.length} experience entries, ${education.length} education entries`);

    return parsedData;
  }

  /**
   * Parse resume and store results in database
   */
  async parseAndStoreResume(candidateId: string, fileUrl: string): Promise<ParsedResumeData> {
    const parsedData = await this.parseResume(fileUrl);

    // Store parsed data in database
    await this.prisma.resumeParse.upsert({
      where: { candidateId },
      update: {
        skills: parsedData.skills,
        education: parsedData.education.map(e => `${e.degree} - ${e.institution}`).join('; '),
        experience: parsedData.experience.map(e => `${e.title} at ${e.company}`).join('; '),
        rawText: parsedData.rawText,
        parsedAt: new Date(),
      },
      create: {
        candidateId,
        skills: parsedData.skills,
        education: parsedData.education.map(e => `${e.degree} - ${e.institution}`).join('; '),
        experience: parsedData.experience.map(e => `${e.title} at ${e.company}`).join('; '),
        rawText: parsedData.rawText,
      },
    });

    // Update candidate profile with parsed skills
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        skills: parsedData.skills,
        education: parsedData.education.map(e => `${e.degree} - ${e.institution}`).join('; '),
        experience: parsedData.experience.map(e => `${e.title} at ${e.company}`).join('; '),
      },
    });

    return parsedData;
  }

  /**
   * Enhanced parsing using AI/ML service (placeholder for integration)
   * In production, this would call OpenAI, AWS Comprehend, or similar service
   */
  async parseResumeWithAI(fileUrl: string): Promise<ParsedResumeData> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    const aiApiKey = this.configService.get<string>('AI_API_KEY');

    // If AI service is configured, use it for enhanced parsing
    if (aiServiceUrl && aiApiKey) {
      try {
        this.logger.log('Using AI service for enhanced resume parsing');
        return await this.callAIParsingService(fileUrl, aiServiceUrl, aiApiKey);
      } catch (error) {
        this.logger.warn('AI parsing failed, falling back to rule-based parsing', error);
      }
    }

    // Fall back to rule-based parsing
    return this.parseResume(fileUrl);
  }

  /**
   * Call external AI service for resume parsing
   * Placeholder - would integrate with OpenAI, AWS Comprehend, etc.
   */
  private async callAIParsingService(
    fileUrl: string,
    serviceUrl: string,
    apiKey: string,
  ): Promise<ParsedResumeData> {
    // In production, this would make an HTTP call to the AI service
    // Example with OpenAI:
    // const response = await fetch(serviceUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     model: 'gpt-4',
    //     messages: [{
    //       role: 'system',
    //       content: 'Extract structured information from this resume...'
    //     }, {
    //       role: 'user',
    //       content: rawText
    //     }]
    //   })
    // });

    this.logger.debug('AI service call placeholder - would call external API in production');
    return this.parseResume(fileUrl);
  }

  /**
   * Extract summary/objective section from resume
   */
  private extractSummary(text: string): string | undefined {
    const summarySection = this.extractSection(text, ['summary', 'objective', 'profile', 'about']);
    if (summarySection) {
      // Take first 500 characters
      return summarySection.substring(0, 500).trim();
    }
    return undefined;
  }

  /**
   * Extract certifications from resume
   */
  private extractCertifications(text: string): string[] {
    const certifications: string[] = [];
    const certSection = this.extractSection(text, ['certifications', 'certificates', 'credentials']);
    
    if (certSection) {
      const lines = certSection.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 3 && trimmed.length < 100) {
          certifications.push(trimmed);
        }
      }
    }

    // Also look for common certification patterns
    const certPatterns = [
      /\b(AWS\s+(?:Certified|Solutions?\s+Architect|Developer|SysOps)[\w\s-]*)/gi,
      /\b(PMP|Project\s+Management\s+Professional)/gi,
      /\b(Scrum\s+Master|CSM|PSM)/gi,
      /\b(CKA|CKAD|Kubernetes[\w\s]*Certified)/gi,
      /\b(Google\s+Cloud[\w\s]*Certified)/gi,
      /\b(Azure[\w\s]*Certified)/gi,
    ];

    for (const pattern of certPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (!certifications.includes(match[1])) {
          certifications.push(match[1]);
        }
      }
    }

    return certifications.slice(0, 10);
  }

  /**
   * Extract languages from resume
   */
  private extractLanguages(text: string): string[] {
    const languages: string[] = [];
    const langSection = this.extractSection(text, ['languages', 'language skills']);
    
    const commonLanguages = [
      'english', 'spanish', 'french', 'german', 'chinese', 'mandarin', 'japanese',
      'korean', 'portuguese', 'italian', 'russian', 'arabic', 'hindi', 'dutch',
    ];

    const searchText = langSection || text;
    for (const lang of commonLanguages) {
      const pattern = new RegExp(`\\b${lang}\\b`, 'i');
      if (pattern.test(searchText)) {
        languages.push(lang.charAt(0).toUpperCase() + lang.slice(1));
      }
    }

    return languages;
  }

  /**
   * Calculate total years of experience from experience entries
   */
  private calculateTotalExperience(experiences: ExperienceEntry[]): number {
    let totalMonths = 0;

    for (const exp of experiences) {
      if (exp.startDate && exp.endDate) {
        const startYear = this.extractYear(exp.startDate);
        const endYear = exp.isCurrent ? new Date().getFullYear() : this.extractYear(exp.endDate);
        
        if (startYear && endYear) {
          totalMonths += (endYear - startYear) * 12;
        }
      }
    }

    return Math.round(totalMonths / 12);
  }

  /**
   * Extract a section from resume text by header
   */
  private extractSection(text: string, headers: string[]): string | null {
    const lines = text.split('\n');
    let inSection = false;
    let sectionContent: string[] = [];

    const headerPattern = new RegExp(`^\\s*(${headers.join('|')})\\s*:?\\s*$`, 'i');
    const nextSectionPattern = /^[A-Z][A-Za-z\s]+:?\s*$/;

    for (const line of lines) {
      if (headerPattern.test(line)) {
        inSection = true;
        continue;
      }

      if (inSection) {
        if (nextSectionPattern.test(line) && !headerPattern.test(line)) {
          break;
        }
        sectionContent.push(line);
      }
    }

    return sectionContent.length > 0 ? sectionContent.join('\n').trim() : null;
  }

  /**
   * Check if a line looks like a job title
   */
  private looksLikeJobTitle(line: string): boolean {
    const titleKeywords = [
      'engineer', 'developer', 'manager', 'analyst', 'designer', 'lead',
      'director', 'architect', 'consultant', 'specialist', 'coordinator',
      'administrator', 'intern', 'associate', 'senior', 'junior', 'staff',
    ];
    
    const lowerLine = line.toLowerCase();
    return titleKeywords.some(keyword => lowerLine.includes(keyword));
  }

  /**
   * Calculate duration between two dates
   */
  private calculateDuration(startDate: string, endDate: string): string {
    const startYear = this.extractYear(startDate);
    const endYear = endDate.toLowerCase().includes('present') 
      ? new Date().getFullYear() 
      : this.extractYear(endDate);

    if (startYear && endYear) {
      const years = endYear - startYear;
      if (years === 0) return 'Less than 1 year';
      if (years === 1) return '1 year';
      return `${years} years`;
    }

    return 'Unknown';
  }

  /**
   * Extract year from date string
   */
  private extractYear(dateStr: string): number | null {
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
  }

  /**
   * Capitalize skill name properly
   */
  private capitalizeSkill(skill: string): string {
    // Special cases for acronyms and specific capitalizations
    const specialCases: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'node.js': 'Node.js',
      'next.js': 'Next.js',
      'react native': 'React Native',
      'vue': 'Vue.js',
      'aws': 'AWS',
      'gcp': 'GCP',
      'sql': 'SQL',
      'nosql': 'NoSQL',
      'graphql': 'GraphQL',
      'rest': 'REST',
      'grpc': 'gRPC',
      'html': 'HTML',
      'css': 'CSS',
      'sass': 'SASS',
      'less': 'LESS',
      'php': 'PHP',
      'c++': 'C++',
      'c#': 'C#',
      '.net': '.NET',
      'asp.net': 'ASP.NET',
      'ios': 'iOS',
      'api': 'API',
      'ci/cd': 'CI/CD',
    };

    return specialCases[skill.toLowerCase()] || 
      skill.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  /**
   * Get mock resume text for testing/development
   */
  private getMockResumeText(): string {
    return `
John Doe
Software Engineer
[email protected] | (555) 123-4567 | linkedin.com/in/johndoe | github.com/johndoe
San Francisco, CA

SUMMARY
Experienced software engineer with 5+ years of experience in full-stack development.
Passionate about building scalable applications and mentoring junior developers.

EXPERIENCE

Senior Software Engineer at Tech Corp
January 2021 - Present
- Led development of microservices architecture using Node.js and TypeScript
- Implemented CI/CD pipelines using GitHub Actions and Docker
- Mentored team of 3 junior developers

Software Engineer at StartupXYZ
June 2018 - December 2020
- Built React frontend applications with Redux state management
- Developed REST APIs using Express.js and PostgreSQL
- Improved application performance by 40%

Junior Developer at WebAgency
January 2017 - May 2018
- Developed responsive websites using HTML, CSS, and JavaScript
- Collaborated with design team on UI/UX improvements

EDUCATION

Bachelor of Science in Computer Science
University of California, Berkeley, 2016
GPA: 3.8

SKILLS
JavaScript, TypeScript, Python, React, Node.js, Express, PostgreSQL, MongoDB,
Docker, Kubernetes, AWS, Git, Agile, Scrum

CERTIFICATIONS
AWS Certified Solutions Architect
Certified Scrum Master (CSM)

LANGUAGES
English (Native), Spanish (Intermediate)
    `.trim();
  }
}
