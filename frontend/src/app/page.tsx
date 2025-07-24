'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSessionContext } from '../contexts/SessionContext';
import { cn, timeAgo, truncateText } from '../lib/utils';
import {
  PlusIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  BeakerIcon,
  LightBulbIcon,
  UserGroupIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

// Template definitions for quick start
const TEMPLATES = [
  {
    id: 'basic',
    name: 'Basic PRD',
    icon: DocumentTextIcon,
    description: 'Simple product requirements document with essential sections',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    id: 'detailed',
    name: 'Detailed PRD',
    icon: CubeIcon,
    description: 'Comprehensive PRD with expanded sections and technical details',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  {
    id: 'mvp',
    name: 'MVP Definition',
    icon: BeakerIcon,
    description: 'Focused on defining minimum viable product requirements',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  {
    id: 'userFocused',
    name: 'User-Centered PRD',
    icon: UserGroupIcon,
    description: 'PRD with emphasis on user stories and experience',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { recentSessions, createNewSession, loadSession } = useSessionContext();
  const [isCreating, setIsCreating] = useState(false);
  const [featuredTemplateId, setFeaturedTemplateId] = useState('basic');

  // Start a new PRD session
  const handleCreateNewPRD = async (templateId?: string) => {
    setIsCreating(true);
    try {
      // Create template-specific initial data
      const initialData = templateId ? getTemplateData(templateId) : {};
      
      const sessionId = await createNewSession(initialData);
      router.push(`/prd/${sessionId}`);
    } catch (error) {
      console.error('Failed to create new PRD:', error);
      setIsCreating(false);
    }
  };

  // Get template-specific initial data
  const getTemplateData = (templateId: string) => {
    // This would be expanded with actual template content
    const defaultData = {
      title: `New PRD - ${new Date().toLocaleDateString()}`,
      description: '',
    };

    switch (templateId) {
      case 'detailed':
        return {
          ...defaultData,
          title: 'Detailed PRD',
          description: 'Comprehensive product requirements document',
          metadata: { template: 'detailed', sections: ['detailedIntroduction', 'marketAnalysis', 'userPersonas', 'userJourneys', 'detailedRequirements', 'technicalSpecifications', 'successMetrics', 'risksAndAssumptions', 'timeline'] }
        };
      case 'mvp':
        return {
          ...defaultData,
          title: 'MVP Definition',
          description: 'Minimum viable product requirements',
          metadata: { template: 'mvp', sections: ['problemStatement', 'targetUsers', 'coreFeatures', 'successCriteria', 'outOfScope', 'timeline'] }
        };
      case 'userFocused':
        return {
          ...defaultData,
          title: 'User-Centered PRD',
          description: 'User-focused product requirements',
          metadata: { template: 'userFocused', sections: ['userProblems', 'userPersonas', 'userStories', 'userJourneys', 'userRequirements', 'userFeedbackPlan', 'successMetrics'] }
        };
      default:
        return {
          ...defaultData,
          metadata: { template: 'basic' }
        };
    }
  };

  // Load an existing session
  const handleLoadSession = (sessionId: string) => {
    router.push(`/prd/${sessionId}`);
  };

  // Rotate featured template periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const templates = TEMPLATES.map(t => t.id);
      const currentIndex = templates.indexOf(featuredTemplateId);
      const nextIndex = (currentIndex + 1) % templates.length;
      setFeaturedTemplateId(templates[nextIndex]);
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval);
  }, [featuredTemplateId]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <header className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">PRD-Maker</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Create professional product requirement documents with AI assistance
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Main action */}
        <div className="lg:col-span-2">
          <div className="card p-8 flex flex-col items-center text-center h-full">
            <h2 className="text-3xl font-bold mb-6">Start Creating Your PRD</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-lg">
              Generate a professional product requirements document with AI-powered assistance. Define your product, capture requirements, and share with your team.
            </p>
            <button
              onClick={() => handleCreateNewPRD()}
              disabled={isCreating}
              className="btn-primary flex items-center text-lg px-8 py-4 mb-4"
            >
              {isCreating ? (
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <>
                  <PlusIcon className="w-6 h-6 mr-2" />
                  Start New PRD
                </>
              )}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No account required to get started
            </p>
          </div>
        </div>

        {/* Featured template */}
        <div>
          <div className="card p-6 h-full">
            <h3 className="font-bold text-lg mb-4">Featured Template</h3>
            {TEMPLATES.map((template) => 
              template.id === featuredTemplateId ? (
                <div 
                  key={template.id}
                  className="flex flex-col h-full"
                >
                  <div className={cn("p-4 rounded-lg flex items-center mb-4", template.color)}>
                    <template.icon className="w-8 h-8 mr-3" />
                    <h4 className="font-bold">{template.name}</h4>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {template.description}
                  </p>
                  <button
                    onClick={() => handleCreateNewPRD(template.id)}
                    disabled={isCreating}
                    className="btn-outline mt-auto flex items-center justify-center"
                  >
                    <LightBulbIcon className="w-5 h-5 mr-2" />
                    Use This Template
                  </button>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent PRDs</h2>
          <Link href="/library" className="text-blue-600 dark:text-blue-400 flex items-center hover:underline">
            View All <ArrowRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {recentSessions && recentSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentSessions.slice(0, 6).map((session) => (
              <button
                key={session.id}
                onClick={() => handleLoadSession(session.id)}
                className="card p-6 text-left hover:shadow-md transition-shadow"
              >
                <h3 className="font-bold mb-2 truncate">{session.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {truncateText(session.description || 'No description', 100)}
                </p>
                <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  {timeAgo(session.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              You don't have any recent PRDs yet
            </p>
            <button
              onClick={() => handleCreateNewPRD()}
              className="btn-outline"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Your First PRD
            </button>
          </div>
        )}
      </div>

      {/* Template gallery */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Quick Start Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TEMPLATES.map((template) => (
            <div key={template.id} className="card p-6">
              <div className={cn("p-4 rounded-lg flex items-center mb-4", template.color)}>
                <template.icon className="w-6 h-6 mr-2" />
                <h3 className="font-bold">{template.name}</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                {template.description}
              </p>
              <button
                onClick={() => handleCreateNewPRD(template.id)}
                className="btn-outline w-full"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}