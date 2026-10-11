'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CustomerReviewDraftOption,
  ExperienceLevel,
  ReviewReplyLanguage,
  ReviewSentiment,
} from '@/lib/types';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Globe2,
  Info,
  MessageSquareHeart,
  Phone,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
} from 'lucide-react';

export interface PublicReviewCampaignView {
  id: string;
  slug: string;
  businessName: string;
  googleReviewUrl: string;
  contactPhone?: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  brandColor: string;
  suggestedHighlights: string[];
  aiDraftsEnabled: boolean;
  defaultLanguage?: ReviewReplyLanguage;
  supportedLanguages?: ReviewReplyLanguage[];
}

interface PublicReviewFlowClientProps {
  campaign: PublicReviewCampaignView;
  aiConfigured?: boolean;
  aiProvider?: string;
  invalidSessionNotice?: boolean;
}

const UI_COPY: Record<
  ReviewReplyLanguage,
  {
    badgeLabel: string;
    nonGoogleNotice: string;
    welcomeText: (biz: string) => string;
    startBtn: string;
    stepLabel: (step: number) => string;
    backBtn: string;
    restartBtn: string;
    qOverall: (biz: string) => string;
    expChoices: Record<ExperienceLevel, { title: string; subtitle: string }>;
    qStarRating: string;
    skipRatingBtn: string;
    continueRatingBtn: string;
    qDetailsPositive: (biz: string) => string;
    qDetailsConstructive: (biz: string) => string;
    detailsPlaceholder: string;
    suggestedTopicsLabel: string;
    topicsPositive: string[];
    topicsConstructive: string[];
    nextBtn: string;
    qAdditional: string;
    additionalPlaceholder: string;
    generateBtn: string;
    skipAndGenerateBtn: string;
    generatingLabel: string;
    finalScreenMessage: string;
    chooseDraftLabel: string;
    writeOwnBtn: string;
    regenerateBtn: string;
    editorLabel: string;
    editReviewBtn: string;
    copyReviewBtn: string;
    copiedLabel: string;
    openGoogleBtn: string;
    finishBtn: string;
    finishedBanner: (biz: string) => string;
    pasteExplanation: string;
    directGoogleFooterLabel: (biz: string) => string;
  }
> = {
  en: {
    badgeLabel: 'AI Review Assistant',
    nonGoogleNotice:
      'Review assistance tool by RM Solution (powered by RMQR) — not an official Google product.',
    welcomeText: (biz) =>
      `Welcome to ${biz}! We'd love to hear about your experience. I'll help you share your honest feedback in just a few steps.`,
    startBtn: 'Start Feedback Conversation',
    stepLabel: (step) => `Step ${step} of 6`,
    backBtn: 'Back',
    restartBtn: 'Restart',
    qOverall: (biz) => `How was your experience with ${biz}?`,
    expChoices: {
      excellent: { title: 'Excellent', subtitle: 'Everything went smoothly and exceeded expectations' },
      good: { title: 'Good', subtitle: 'Positive overall experience' },
      average: { title: 'Average', subtitle: 'Some parts were okay, some could be better' },
      needs_improvement: {
        title: 'Needs improvement',
        subtitle: 'I faced an issue or delay that needs attention',
      },
    },
    qStarRating:
      'Would you like to select a star rating (1–5 stars)? You can also skip this step.',
    skipRatingBtn: 'Skip Rating',
    continueRatingBtn: 'Continue',
    qDetailsPositive: (biz) =>
      `What did you like most about your experience with ${biz}?`,
    qDetailsConstructive: (biz) =>
      `What went wrong or what could ${biz} improve? Your honest feedback is valued.`,
    detailsPlaceholder:
      'Type a few words in your own words (e.g., polite staff, quick documentation, or waiting time)...',
    suggestedTopicsLabel: 'Optional: Tap any topics that apply',
    topicsPositive: [
      'Helpful Guidance',
      'Quick Service',
      'Polite Support',
      'Clear Information',
      'Smooth Process',
    ],
    topicsConstructive: [
      'Waiting Time',
      'Communication Update',
      'Process Clarity',
      'Follow-up Support',
      'Service Speed',
    ],
    nextBtn: 'Next Step',
    qAdditional: 'Would you like to add anything else before I prepare your review suggestions?',
    additionalPlaceholder: 'Optional: Any additional detail you want to mention...',
    generateBtn: 'Generate Review Suggestions',
    skipAndGenerateBtn: 'Skip & Generate Suggestions',
    generatingLabel: 'Preparing 3 honest review suggestions...',
    finalScreenMessage:
      'Your feedback is ready. You can edit or copy it, then continue to Google to submit your review if you choose.',
    chooseDraftLabel: 'Select one of the 3 suggestions or write your own:',
    writeOwnBtn: 'Write My Own Review',
    regenerateBtn: 'Regenerate Options',
    editorLabel: 'Your Review Preview (Editable):',
    editReviewBtn: 'Edit Review',
    copyReviewBtn: 'Copy Review',
    copiedLabel: 'Copied to Clipboard!',
    openGoogleBtn: 'Open Google Reviews',
    finishBtn: 'Finish',
    finishedBanner: (biz) =>
      `Thank you for sharing your feedback with ${biz}! Whenever you are ready, you can open Google Reviews below to paste and submit your review.`,
    pasteExplanation:
      "Note: Google does not automatically prefill or auto-submit third-party review drafts. After clicking Open Google Reviews, paste your copied text into Google's review form and submit it manually.",
    directGoogleFooterLabel: (biz) =>
      `Prefer to skip the assistant? Open ${biz}'s official Google Review page directly:`,
  },
  hi: {
    badgeLabel: 'AI रिव्यू सहायक (AI Review Assistant)',
    nonGoogleNotice:
      'यह RM Solution का रिव्यू सहायता टूल है (RMQR द्वारा संचालित) — यह Google का आधिकारिक उत्पाद नहीं है।',
    welcomeText: (biz) =>
      `${biz} में आपका स्वागत है! हम आपका अनुभव जानना चाहेंगे। मैं कुछ ही आसान चरणों में आपकी ईमानदार प्रतिक्रिया साझा करने में मदद करूँगा।`,
    startBtn: 'प्रतिक्रिया बातचीत शुरू करें',
    stepLabel: (step) => `चरण ${step} / 6`,
    backBtn: 'पीछे जाएं (Back)',
    restartBtn: 'फिर से शुरू करें (Restart)',
    qOverall: (biz) => `${biz} के साथ आपका अनुभव कैसा रहा?`,
    expChoices: {
      excellent: { title: 'उत्कृष्ट (Excellent)', subtitle: 'सब कुछ बहुत अच्छा और सुगम रहा' },
      good: { title: 'अच्छा (Good)', subtitle: 'सकारात्मक समग्र अनुभव' },
      average: { title: 'औसत (Average)', subtitle: 'कुछ बातें ठीक रहीं, कुछ और बेहतर हो सकती हैं' },
      needs_improvement: {
        title: 'सुधार की आवश्यकता है (Needs improvement)',
        subtitle: 'मुझे किसी समस्या या देरी का सामना करना पड़ा',
      },
    },
    qStarRating:
      'क्या आप 1 से 5 स्टार रेटिंग चुनना चाहेंगे? आप चाहें तो इसे छोड़ (Skip) भी सकते हैं।',
    skipRatingBtn: 'रेटिंग छोड़ें (Skip Rating)',
    continueRatingBtn: 'आगे बढ़ें',
    qDetailsPositive: (biz) => `${biz} में आपको सबसे अच्छा क्या लगा?`,
    qDetailsConstructive: (biz) =>
      `आपको क्या असुविधा हुई या ${biz} किस चीज़ में सुधार कर सकता है?`,
    detailsPlaceholder:
      'अपने शब्दों में कुछ पंक्तियाँ लिखें (जैसे: विनम्र स्टाफ, तेज़ कार्य, या प्रतीक्षा समय)...',
    suggestedTopicsLabel: 'वैकल्पिक: उपयुक्त विषय चुनें',
    topicsPositive: [
      'सहायक मार्गदर्शन',
      'तेज़ सेवा',
      'विनम्र व्यवहार',
      'स्पष्ट जानकारी',
      'सरल प्रक्रिया',
    ],
    topicsConstructive: [
      'प्रतीक्षा समय',
      'स्टेटस अपडेट',
      'प्रक्रिया स्पष्टता',
      'फॉलो-अप सहायता',
      'सेवा गति',
    ],
    nextBtn: 'अगला चरण',
    qAdditional: 'क्या आप कुछ और जोड़ना चाहेंगे? आप इसे छोड़ भी सकते हैं।',
    additionalPlaceholder: 'वैकल्पिक: कोई अन्य बात जो आप लिखना चाहें...',
    generateBtn: 'रिव्यू सुझाव तैयार करें',
    skipAndGenerateBtn: 'छोड़ें और सुझाव देखें',
    generatingLabel: 'आपके उत्तरों के आधार पर 3 ईमानदार रिव्यू सुझाव तैयार किए जा रहे हैं...',
    finalScreenMessage:
      'आपकी प्रतिक्रिया तैयार है। आप इसे संपादित या कॉपी कर सकते हैं, और फिर चाहें तो अपना रिव्यू सबमिट करने के लिए Google पर जा सकते हैं।',
    chooseDraftLabel: 'नीचे दिए गए 3 विकल्पों में से चुनें या स्वयं लिखें:',
    writeOwnBtn: 'अपना रिव्यू स्वयं लिखें',
    regenerateBtn: 'नए विकल्प बनाएं',
    editorLabel: 'आपका रिव्यू पूर्वावलोकन (संपादनीय):',
    editReviewBtn: 'रिव्यू संपादित करें (Edit Review)',
    copyReviewBtn: 'रिव्यू कॉपी करें (Copy Review)',
    copiedLabel: 'कॉपी हो गया!',
    openGoogleBtn: 'Google Reviews खोलें (Open Google Reviews)',
    finishBtn: 'समाप्त करें (Finish)',
    finishedBanner: (biz) =>
      `${biz} के साथ अपनी प्रतिक्रिया साझा करने के लिए धन्यवाद! आप नीचे दिए गए बटन से Google Reviews खोलकर अपना रिव्यू पेस्ट और सबमिट कर सकते हैं।`,
    pasteExplanation:
      'नोट: Google बाहरी वेबसाइटों से रिव्यू टेक्स्ट अपने आप नहीं भरता है। Open Google Reviews पर क्लिक करने के बाद, कॉपी किया गया टेक्स्ट Google के रिव्यू बॉक्स में पेस्ट करें और स्वयं सबमिट करें।',
    directGoogleFooterLabel: (biz) =>
      `सीधे Google पर जाना चाहते हैं? ${biz} का आधिकारिक Google Review पेज खोलें:`,
  },
  mr: {
    badgeLabel: 'AI रिव्ह्यू सहाय्यक (AI Review Assistant)',
    nonGoogleNotice:
      'हे RM Solution चे रिव्ह्यू सहाय्य साधन आहे (RMQR द्वारे संचालित) — हे अधिकृत Google उत्पादन नाही.',
    welcomeText: (biz) =>
      `${biz} मध्ये आपले स्वागत आहे! आम्हाला आपला अनुभव जाणून घ्यायला आवडेल. मी काही सोप्या टप्प्यांत आपला प्रामाणिक अभिप्राय मांडण्यात मदत करेन.`,
    startBtn: 'अभिप्राय संवाद सुरू करा',
    stepLabel: (step) => `टप्पा ${step} / 6`,
    backBtn: 'मागे जा (Back)',
    restartBtn: 'पुन्हा सुरू करा (Restart)',
    qOverall: (biz) => `${biz} सोबतचा आपला अनुभव कसा होता?`,
    expChoices: {
      excellent: { title: 'उत्कृष्ट (Excellent)', subtitle: 'सर्व काम अतिशय छान आणि सुरळीत झाले' },
      good: { title: 'चांगला (Good)', subtitle: 'एकंदरीत चांगला अनुभव' },
      average: { title: 'साधारण (Average)', subtitle: 'काही गोष्टी चांगल्या होत्या, काहीत सुधारणा शक्य आहे' },
      needs_improvement: {
        title: 'सुधारणेची गरज (Needs improvement)',
        subtitle: 'मला काही अडचण किंवा विलंबाचा सामना करावा लागला',
      },
    },
    qStarRating:
      'आपण 1 ते 5 स्टार रेटिंग देऊ इच्छिता का? आपण हा टप्पा वगळू (Skip) देखील शकता.',
    skipRatingBtn: 'रेटिंग वगळा (Skip Rating)',
    continueRatingBtn: 'पुढे जा',
    qDetailsPositive: (biz) => `${biz} मधील कोणती गोष्ट आपल्याला सर्वात जास्त आवडली?`,
    qDetailsConstructive: (biz) =>
      `कोणती अडचण आली किंवा ${biz} मध्ये कशात सुधारणा करता येईल?`,
    detailsPlaceholder:
      'आपल्या शब्दांत थोडक्यात लिहा (उदा. तत्पर सेवा, योग्य मार्गदर्शन, किंवा प्रतीक्षा वेळ)...',
    suggestedTopicsLabel: 'ऐच्छिक: लागू असणारे मुद्दे निवडा',
    topicsPositive: [
      'उपयुक्त मार्गदर्शन',
      'तत्पर सेवा',
      'नम्र सहकार्य',
      'स्पष्ट माहिती',
      'सुरळीत प्रक्रिया',
    ],
    topicsConstructive: [
      'प्रतीक्षा वेळ',
      'स्टेटस अपडेट',
      'प्रक्रियेतील स्पष्टता',
      'फॉलो-अप मदत',
      'सेवेचा वेग',
    ],
    nextBtn: 'पुढील टप्पा',
    qAdditional: 'रिव्ह्यू मसुदा तयार करण्यापूर्वी आपल्याला आणखी काही सांगायचे आहे का?',
    additionalPlaceholder: 'ऐच्छिक: आपण जोडू इच्छित असलेली इतर कोणतीही माहिती...',
    generateBtn: 'रिव्ह्यू पर्याय तयार करा',
    skipAndGenerateBtn: 'वगळा आणि पर्याय पहा',
    generatingLabel: 'आपल्या उत्तरांवर आधारित 3 प्रामाणिक रिव्ह्यू पर्याय तयार केले जात आहेत...',
    finalScreenMessage:
      'आपला अभिप्राय तयार आहे. आपण तो संपादित किंवा कॉपी करू शकता आणि त्यानंतर इच्छित असल्यास Google वर जाऊन आपला रिव्ह्यू सबमिट करू शकता.',
    chooseDraftLabel: 'खालील 3 पर्यायांपैकी एक निवडा किंवा स्वतःचा रिव्ह्यू लिहा:',
    writeOwnBtn: 'माझा स्वतःचा रिव्ह्यू लिहा',
    regenerateBtn: 'नवीन पर्याय तयार करा',
    editorLabel: 'आपला रिव्ह्यू प्रिव्ह्यू (संपादनीय):',
    editReviewBtn: 'रिव्ह्यू संपादित करा (Edit Review)',
    copyReviewBtn: 'रिव्ह्यू कॉपी करा (Copy Review)',
    copiedLabel: 'क्लिपबोर्डवर कॉपी झाले!',
    openGoogleBtn: 'Google Reviews उघडा (Open Google Reviews)',
    finishBtn: 'पूर्ण करा (Finish)',
    finishedBanner: (biz) =>
      `${biz} सोबत आपला अभिप्राय शेअर केल्याबद्दल धन्यवाद! आपण खालील बटणावरून Google Reviews उघडून आपला रिव्ह्यू पेस्ट आणि सबमिट करू शकता.`,
    pasteExplanation:
      'टीप: Google कोणत्याही बाह्य वेबसाइटवरून रिव्ह्यू आपोआप भरत नाही किंवा सबमिट करत नाही. Open Google Reviews वर क्लिक केल्यानंतर, कॉपी केलेला मजकूर Google च्या रिव्ह्यू बॉक्समध्ये पेस्ट करा आणि स्वतः सबमिट करा.',
    directGoogleFooterLabel: (biz) =>
      `थेट Google वर जायचे आहे का? ${biz} चे अधिकृत Google Review पेज उघडा:`,
  },
};

export function PublicReviewFlowClient({
  campaign,
  aiConfigured = false,
  aiProvider = 'unconfigured',
  invalidSessionNotice = false,
}: PublicReviewFlowClientProps) {
  const [language, setLanguage] = useState<ReviewReplyLanguage>(
    campaign.defaultLanguage || 'en'
  );
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Customer feedback state
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('excellent');
  const [starRating, setStarRating] = useState<number | null>(5);
  const [feedbackDetails, setFeedbackDetails] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [additionalFeedback, setAdditionalFeedback] = useState<string>('');

  // Step 6 Generated Drafts & Editor State
  const [draftOptions, setDraftOptions] = useState<CustomerReviewDraftOption[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<
    'short' | 'detailed' | 'professional' | 'custom'
  >('short');
  const [editableReviewText, setEditableReviewText] = useState<string>('');
  const [sentimentPreserved, setSentimentPreserved] = useState<ReviewSentiment>('positive');
  const [providerStatusMessage, setProviderStatusMessage] = useState<string>('');
  const [followUpPrompt, setFollowUpPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [sessionFinished, setSessionFinished] = useState<boolean>(false);
  const [regenerationCount, setRegenerationCount] = useState<number>(0);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const copy = UI_COPY[language];
  const isConstructive =
    experienceLevel === 'average' ||
    experienceLevel === 'needs_improvement' ||
    (starRating !== null && starRating <= 3);

  const availableTopics = isConstructive
    ? copy.topicsConstructive
    : copy.topicsPositive.length > 0
    ? copy.topicsPositive
    : campaign.suggestedHighlights;

  // Start a privacy-safe anonymous review session on mount
  useEffect(() => {
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_review_session',
        slug: campaign.slug,
        language,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.sessionId && data?.sessionToken) {
          setSessionId(data.sessionId);
          setSessionToken(data.sessionToken);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.slug]);

  const handleLanguageSwitch = (newLang: ReviewReplyLanguage) => {
    setLanguage(newLang);
    setSelectedTopics([]);
    setErrorMessage(null);
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]
    );
  };

  const handleGenerateDrafts = async (overrideAdditional?: string) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_agent_review_drafts',
          slug: campaign.slug,
          sessionId: sessionId || undefined,
          sessionToken: sessionToken || undefined,
          language,
          experienceLevel,
          starRating,
          feedbackDetails,
          selectedTopics,
          additionalFeedback:
            overrideAdditional !== undefined ? overrideAdditional : additionalFeedback,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.error || 'Could not generate review suggestions right now. You can write your review below.'
        );
        setStep(6);
        return;
      }

      const options: CustomerReviewDraftOption[] = Array.isArray(data.draftOptions)
        ? data.draftOptions
        : [];
      setDraftOptions(options);
      if (options.length > 0) {
        setSelectedDraftId(options[0].id);
        setEditableReviewText(options[0].text);
      }
      if (data.sentimentPreserved) {
        setSentimentPreserved(data.sentimentPreserved);
      }
      if (data.providerStatusMessage) {
        setProviderStatusMessage(data.providerStatusMessage);
      }
      setFollowUpPrompt(data.followUpPrompt || null);
      setRegenerationCount((prev) => prev + 1);
      setStep(6);
    } catch {
      setErrorMessage(
        'Network error while generating suggestions. You can still write your review manually below and continue to Google.'
      );
      setStep(6);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectDraft = (opt: CustomerReviewDraftOption) => {
    setSelectedDraftId(opt.id);
    setEditableReviewText(opt.text);
    setCopied(false);
  };

  const handleWriteOwnReview = () => {
    setSelectedDraftId('custom');
    setEditableReviewText(feedbackDetails ? `${feedbackDetails}` : '');
    setCopied(false);
    setTimeout(() => {
      editorRef.current?.focus();
    }, 50);
  };

  const handleCopyReview = () => {
    if (!editableReviewText.trim()) return;
    navigator.clipboard.writeText(editableReviewText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);

    if (sessionId && sessionToken) {
      fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_review_session',
          sessionId,
          sessionToken,
          selectedDraft: editableReviewText,
          status: 'copied',
        }),
      }).catch(() => {});
    }
  };

  const handleContinueToGoogle = () => {
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track_google_click',
        campaignId: campaign.id,
      }),
    }).catch(() => {});

    if (sessionId && sessionToken) {
      fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_review_session',
          sessionId,
          sessionToken,
          selectedDraft: editableReviewText,
          status: 'google_opened',
        }),
      }).catch(() => {});
    }
  };

  const handleFinishSession = () => {
    setSessionFinished(true);
    if (sessionId && sessionToken) {
      fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_review_session',
          sessionId,
          sessionToken,
          selectedDraft: editableReviewText,
          status: 'completed',
        }),
      }).catch(() => {});
    }
  };

  const handleRestart = () => {
    setStep(1);
    setExperienceLevel('excellent');
    setStarRating(5);
    setFeedbackDetails('');
    setSelectedTopics([]);
    setAdditionalFeedback('');
    setDraftOptions([]);
    setEditableReviewText('');
    setErrorMessage(null);
    setCopied(false);
    setSessionFinished(false);
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5 | 6);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center justify-center p-3 sm:p-6 py-8">
      <main
        data-testid="ai-review-agent-container"
        className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 p-5 sm:p-7 shadow-2xl space-y-5"
      >
        {/* Top Header: RM Solution Branding + Language Switcher */}
        <div className="space-y-3 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-300">
              <Bot className="h-3.5 w-3.5 text-violet-400" />
              <span>{campaign.businessName}</span>
              <span className="text-slate-500">•</span>
              <span>{copy.badgeLabel}</span>
            </div>

            {campaign.contactPhone && (
              <a
                href={`tel:+91${campaign.contactPhone.replace(/[^\d]/g, '').slice(-10)}`}
                data-testid="public-agent-support-phone"
                className="inline-flex items-center gap-1 rounded-full bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-mono text-slate-300"
              >
                <Phone className="h-3 w-3 text-emerald-400" />
                {campaign.contactPhone}
              </a>
            )}
          </div>

          <div className="space-y-1">
            <h1
              className="text-xl sm:text-2xl font-extrabold text-white"
              data-testid="review-flow-headline"
            >
              {campaign.headline}
            </h1>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {copy.nonGoogleNotice}
            </p>
          </div>

          {/* Language Selection Buttons (English, हिंदी, मराठी) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
              <Globe2 className="h-3.5 w-3.5 text-violet-400" /> Language:
            </span>
            <div className="flex items-center gap-1.5" role="group" aria-label="Select Language">
              <button
                type="button"
                data-testid="lang-btn-en"
                onClick={() => handleLanguageSwitch('en')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  language === 'en'
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                English
              </button>
              <button
                type="button"
                data-testid="lang-btn-hi"
                onClick={() => handleLanguageSwitch('hi')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  language === 'hi'
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                data-testid="lang-btn-mr"
                onClick={() => handleLanguageSwitch('mr')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  language === 'mr'
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                मराठी
              </button>
            </div>
          </div>
        </div>

        {/* Invalid Session Graceful Fallback Notice */}
        {invalidSessionNotice && (
          <div
            role="status"
            data-testid="invalid-session-fallback-banner"
            className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300"
          >
            <Info className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Your previous review session expired or was invalid. We started a fresh session for
              you below.
            </span>
          </div>
        )}

        {/* Progress Bar + Back & Restart Navigation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span
              data-testid="conversation-step-indicator"
              className="font-bold text-violet-400"
            >
              {copy.stepLabel(step)}
            </span>
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  data-testid="step-back-btn"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                >
                  <ArrowLeft className="h-3 w-3" /> {copy.backBtn}
                </button>
              )}
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleRestart}
                  data-testid="step-restart-btn"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                >
                  <RotateCcw className="h-3 w-3" /> {copy.restartBtn}
                </button>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="conversation-error-banner"
            className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4" data-testid="review-step-1">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                <MessageSquareHeart className="h-4 w-4" />
              </div>
              <p
                data-testid="agent-welcome-message"
                className="text-sm text-slate-200 leading-relaxed"
              >
                {copy.welcomeText(campaign.businessName)}
              </p>
            </div>

            <button
              type="button"
              data-testid="start-conversation-btn"
              onClick={() => setStep(2)}
              className="w-full rounded-2xl bg-violet-600 hover:bg-violet-500 py-3.5 px-5 text-sm font-extrabold text-white shadow-lg shadow-violet-600/25 transition-all"
            >
              {copy.startBtn}
            </button>
          </div>
        )}

        {/* STEP 2: Overall Experience */}
        {step === 2 && (
          <div className="space-y-4" data-testid="review-step-2">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                {copy.qOverall(campaign.businessName)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {(
                ['excellent', 'good', 'average', 'needs_improvement'] as ExperienceLevel[]
              ).map((level) => {
                const item = copy.expChoices[level];
                const isSelected = experienceLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    data-testid={`exp-choice-${level}`}
                    onClick={() => {
                      setExperienceLevel(level);
                      if (level === 'excellent') setStarRating(5);
                      else if (level === 'good') setStarRating(4);
                      else if (level === 'average') setStarRating(3);
                      else setStarRating(2);
                      setStep(3);
                    }}
                    className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-600/15'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-bold text-white">{item.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Star Rating (1-5 or Skip) */}
        {step === 3 && (
          <div className="space-y-4" data-testid="review-step-3">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                {copy.qStarRating}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  data-testid={`star-rating-btn-${star}`}
                  onClick={() => setStarRating(star)}
                  aria-label={`Rate ${star} stars`}
                  className="p-2 rounded-xl transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      starRating !== null && star <= starRating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="skip-rating-btn"
                onClick={() => {
                  setStarRating(null);
                  setStep(4);
                }}
                className="rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-3 px-4 text-xs font-bold text-slate-300"
              >
                {copy.skipRatingBtn}
              </button>
              <button
                type="button"
                data-testid="confirm-rating-btn"
                onClick={() => setStep(4)}
                className="rounded-2xl bg-violet-600 hover:bg-violet-500 py-3 px-4 text-xs font-extrabold text-white"
              >
                {copy.continueRatingBtn} {starRating ? `(${starRating}★)` : ''}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Feedback Details + Optional Topics */}
        {step === 4 && (
          <div className="space-y-4" data-testid="review-step-4">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                {isConstructive
                  ? copy.qDetailsConstructive(campaign.businessName)
                  : copy.qDetailsPositive(campaign.businessName)}
              </p>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-300">
                {copy.suggestedTopicsLabel}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableTopics.map((topic, idx) => {
                  const active = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      data-testid={`topic-chip-${idx}`}
                      onClick={() => toggleTopic(topic)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <textarea
                rows={3}
                value={feedbackDetails}
                onChange={(e) => setFeedbackDetails(e.target.value)}
                placeholder={copy.detailsPlaceholder}
                data-testid="feedback-details-input"
                maxLength={600}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3.5 text-xs text-white placeholder-slate-500 leading-relaxed focus:border-violet-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              data-testid="step-4-next-btn"
              onClick={() => setStep(5)}
              className="w-full rounded-2xl bg-violet-600 hover:bg-violet-500 py-3.5 px-5 text-xs font-extrabold text-white"
            >
              {copy.nextBtn}
            </button>
          </div>
        )}

        {/* STEP 5: Additional Feedback (Optional) */}
        {step === 5 && (
          <div className="space-y-4" data-testid="review-step-5">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                {copy.qAdditional}
              </p>
            </div>

            <textarea
              rows={2}
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              placeholder={copy.additionalPlaceholder}
              data-testid="additional-feedback-input"
              maxLength={400}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3.5 text-xs text-white placeholder-slate-500 leading-relaxed focus:border-violet-500 focus:outline-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isGenerating}
                data-testid="skip-step-5-btn"
                onClick={() => {
                  setAdditionalFeedback('');
                  handleGenerateDrafts('');
                }}
                className="rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-3 px-4 text-xs font-bold text-slate-300 disabled:opacity-50"
              >
                {copy.skipAndGenerateBtn}
              </button>
              <button
                type="button"
                disabled={isGenerating}
                data-testid="generate-suggestions-btn"
                onClick={() => handleGenerateDrafts()}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-violet-600 hover:bg-violet-500 py-3 px-4 text-xs font-extrabold text-white disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isGenerating ? copy.generatingLabel : copy.generateBtn}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Review Suggestions & Customer-Approved Final Screen */}
        {step === 6 && (
          <div className="space-y-4" data-testid="review-step-6">
            {/* Final Screen Message */}
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
              <div className="space-y-1">
                <p
                  data-testid="final-screen-message"
                  className="text-xs sm:text-sm font-bold text-emerald-200 leading-relaxed"
                >
                  {copy.finalScreenMessage}
                </p>
                <span
                  data-testid="preserved-sentiment-badge"
                  className="inline-block rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300"
                >
                  Sentiment: {sentimentPreserved}
                </span>
              </div>
            </div>

            {/* Honest AI Configuration Status */}
            <div
              data-testid="customer-ai-status-badge"
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400 flex items-start gap-2"
            >
              <Info className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
              <span>
                {providerStatusMessage ||
                  (aiConfigured
                    ? `AI Review Assistant (${aiProvider}) active.`
                    : 'Live AI API key is not configured in this environment. Grounded review templates and manual review editing are active.')}
              </span>
            </div>

            {/* Follow-up tip if minimal details were provided */}
            {followUpPrompt && (
              <div
                data-testid="insufficient-info-followup"
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300"
              >
                {followUpPrompt}
              </div>
            )}

            {/* 3 Draft Options Selector */}
            {draftOptions.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-violet-300">
                    {copy.chooseDraftLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="write-own-review-btn"
                      onClick={handleWriteOwnReview}
                      className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200"
                    >
                      {copy.writeOwnBtn}
                    </button>
                    <button
                      type="button"
                      disabled={isGenerating || regenerationCount >= 4}
                      data-testid="regenerate-drafts-btn"
                      onClick={() => handleGenerateDrafts()}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-violet-300 disabled:opacity-40"
                    >
                      <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                      {copy.regenerateBtn}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2" data-testid="customer-draft-options-list">
                  {draftOptions.map((opt) => {
                    const isSelected = selectedDraftId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`draft-option-${opt.id}`}
                        onClick={() => handleSelectDraft(opt)}
                        className={`text-left rounded-2xl border p-3.5 transition-all ${
                          isSelected
                            ? 'border-violet-500 bg-violet-600/15 shadow-sm'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-extrabold text-violet-300">
                            {opt.label}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {isSelected ? 'Selected' : 'Tap to Use'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">{opt.text}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Editable Review Textarea */}
            <div className="space-y-1.5">
              <label
                htmlFor="customer-review-editor-box"
                className="block text-xs font-bold text-slate-200"
              >
                {copy.editorLabel}
              </label>
              <textarea
                id="customer-review-editor-box"
                ref={editorRef}
                rows={4}
                value={editableReviewText}
                onChange={(e) => {
                  setEditableReviewText(e.target.value);
                  setCopied(false);
                }}
                data-testid="customer-review-editor"
                placeholder="Write or edit your honest review here..."
                className="w-full rounded-2xl border border-violet-500/40 bg-slate-950 p-3.5 text-xs text-white leading-relaxed focus:border-violet-400 focus:outline-none"
              />
            </div>

            {/* Action Buttons: Edit Review, Copy Review, Open Google Reviews, Finish */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="edit-review-btn"
                onClick={() => editorRef.current?.focus()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 px-3 text-xs font-bold text-slate-200"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {copy.editReviewBtn}
              </button>

              <button
                type="button"
                data-testid="copy-review-btn"
                onClick={handleCopyReview}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 px-3 text-xs font-bold text-white"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {copy.copiedLabel}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    {copy.copyReviewBtn}
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                href={campaign.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleContinueToGoogle}
                data-testid="open-google-reviews-btn"
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-500 py-3.5 px-5 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-violet-600/30"
              >
                <span>{copy.openGoogleBtn}</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <button
                type="button"
                data-testid="finish-review-btn"
                onClick={handleFinishSession}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-3.5 px-4 text-xs font-bold text-slate-200"
              >
                {copy.finishBtn}
              </button>
            </div>

            {sessionFinished && (
              <div
                role="status"
                data-testid="session-finished-banner"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
              >
                {copy.finishedBanner(campaign.businessName)}
              </div>
            )}

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {copy.pasteExplanation}
            </p>
          </div>
        )}

        {/* Persistent Direct Google Review Destination Link (Available on Every Step & Sentiment) */}
        <div className="pt-3 border-t border-slate-800/90 space-y-2">
          <p className="text-[11px] text-center text-slate-400">
            {copy.directGoogleFooterLabel(campaign.businessName)}
          </p>
          <a
            href={campaign.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleContinueToGoogle}
            data-testid="google-review-destination-btn"
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 py-3 px-5 text-xs font-extrabold text-violet-200 transition-all"
          >
            <span>{campaign.ctaText || copy.openGoogleBtn}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  );
}
