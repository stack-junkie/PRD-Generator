import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  DocumentTextIcon,
  TargetIcon,
  UserGroupIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../hooks/useTheme';
import Tooltip from './Tooltip';

const SECTION_CONFIG = {
  introduction: {
    name: 'Introduction',
    shortName: 'Intro',
    icon: DocumentTextIcon,
    description: 'Product overview and problem statement'
  },
  goals: {
    name: 'Goals & Objectives',
    shortName: 'Goals',
    icon: TargetIcon,
    description: 'Business objectives and success metrics'
  },
  audience: {
    name: 'Target Audience',
    shortName: 'Audience',
    icon: UserGroupIcon,
    description: 'User personas and demographics'
  },
  userStories: {
    name: 'User Stories',
    shortName: 'Stories',
    icon: BookOpenIcon,
    description: 'User journeys and workflows'
  },
  requirements: {
    name: 'Requirements',
    shortName: 'Reqs',
    icon: Cog6ToothIcon,
    description: 'Functional and technical requirements'
  },
  metrics: {
    name: 'Success Metrics',
    shortName: 'Metrics',
    icon: ChartBarIcon,
    description: 'KPIs and measurement criteria'
  },
  questions: {
    name: 'Open Questions',
    shortName: 'Questions',
    icon: QuestionMarkCircleIcon,
    description: 'Remaining concerns and uncertainties'
  }
};

const SECTION_STATES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  NEEDS_REVISION: 'needs_revision',
  COMPLETED: 'completed'
};

const ProgressTracker = ({ 
  sections, 
  currentSection, 
  completedSections = [], 
  onSectionClick,
  className = ''
}) => {
  const { isDarkMode } = useTheme();
  const [hoveredSection, setHoveredSection] = useState(null);
  const [focusedSection, setFocusedSection] = useState(null);
  const [announceText, setAnnounceText] = useState('');
  const progressRef = useRef(null);

  // Calculate overall progress percentage
  const progressPercentage = Math.round((completedSections.length / sections.length) * 100);

  // Get section state
  const getSectionState = (sectionId, index) => {
    if (completedSections.some(cs => cs.id === sectionId && cs.needsRevision)) {
      return SECTION_STATES.NEEDS_REVISION;
    }
    if (completedSections.some(cs => cs.id === sectionId)) {
      return SECTION_STATES.COMPLETED;
    }
    if (currentSection === index) {
      return SECTION_STATES.IN_PROGRESS;
    }
    return SECTION_STATES.NOT_STARTED;
  };

  // Get section colors based on state
  const getSectionColors = (state) => {
    const colors = {
      [SECTION_STATES.NOT_STARTED]: {
        bg: isDarkMode ? 'bg-gray-700' : 'bg-gray-200',
        border: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        text: isDarkMode ? 'text-gray-400' : 'text-gray-500',
        icon: isDarkMode ? 'text-gray-500' : 'text-gray-400'
      },
      [SECTION_STATES.IN_PROGRESS]: {
        bg: 'bg-blue-500',
        border: 'border-blue-400',
        text: 'text-white',
        icon: 'text-white',
        pulse: true
      },
      [SECTION_STATES.NEEDS_REVISION]: {
        bg: 'bg-yellow-500',
        border: 'border-yellow-400',
        text: 'text-white',
        icon: 'text-white'
      },
      [SECTION_STATES.COMPLETED]: {
        bg: 'bg-green-500',
        border: 'border-green-400',
        text: 'text-white',
        icon: 'text-white'
      }
    };
    return colors[state];
  };

  // Handle section click
  const handleSectionClick = (sectionId, index) => {
    // Only allow navigation to completed sections or current section
    if (index <= currentSection || completedSections.some(cs => cs.id === sectionId)) {
      onSectionClick?.(sectionId, index);
      setAnnounceText(`Navigated to ${SECTION_CONFIG[sectionId]?.name || sectionId} section`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event, sectionId, index) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSectionClick(sectionId, index);
    }
  };

  // Announce progress changes
  useEffect(() => {
    if (announceText) {
      const timer = setTimeout(() => setAnnounceText(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [announceText]);

  // Section tooltip content
  const getSectionTooltip = (section, index, state) => {
    const config = SECTION_CONFIG[section.id] || {};
    const completedSection = completedSections.find(cs => cs.id === section.id);
    
    return (
      <div className="text-sm">
        <div className="font-semibold mb-1">{config.name}</div>
        <div className="text-gray-300 mb-2">{config.description}</div>
        <div className="flex items-center gap-2">
          <span className="capitalize">{state.replace('_', ' ')}</span>
          {completedSection?.validationScore && (
            <span className="text-xs bg-gray-700 px-2 py-1 rounded">
              Score: {completedSection.validationScore}/100
            </span>
          )}
        </div>
        {index > currentSection && !completedSections.some(cs => cs.id === section.id) && (
          <div className="text-yellow-300 text-xs mt-1">
            Complete previous sections first
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`progress-tracker ${className}`} ref={progressRef}>
      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announceText}
      </div>

      {/* Overall progress header */}
      <div className={`mb-6 text-center ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
        <div className="flex items-center justify-center gap-3 mb-2">
          <h2 className="text-lg font-semibold">PRD Progress</h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            progressPercentage >= 80
              ? 'bg-green-100 text-green-800'
              : progressPercentage >= 50
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {progressPercentage}% Complete
          </div>
        </div>
        
        {/* Overall progress bar */}
        <div className={`w-full h-2 rounded-full ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Desktop horizontal layout */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className={`absolute top-6 left-6 right-6 h-0.5 ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`} />
          
          {/* Progress line overlay */}
          <div 
            className="absolute top-6 left-6 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500 ease-out"
            style={{ 
              width: `${Math.max(0, ((completedSections.length - 1) / (sections.length - 1)) * 100)}%` 
            }}
          />

          {sections.map((section, index) => {
            const state = getSectionState(section.id, index);
            const colors = getSectionColors(state);
            const config = SECTION_CONFIG[section.id] || {};
            const IconComponent = config.icon || DocumentTextIcon;
            const isClickable = index <= currentSection || completedSections.some(cs => cs.id === section.id);
            const completedSection = completedSections.find(cs => cs.id === section.id);

            return (
              <Tooltip
                key={section.id}
                content={getSectionTooltip(section, index, state)}
                disabled={!hoveredSection || hoveredSection !== section.id}
              >
                <div className="relative flex flex-col items-center">
                  {/* Section circle */}
                  <button
                    className={`relative w-12 h-12 rounded-full border-2 transition-all duration-300 transform ${
                      colors.bg
                    } ${colors.border} ${
                      isClickable 
                        ? 'hover:scale-110 focus:scale-110 cursor-pointer' 
                        : 'cursor-not-allowed opacity-60'
                    } ${
                      colors.pulse ? 'animate-pulse' : ''
                    } ${
                      focusedSection === section.id 
                        ? 'ring-4 ring-blue-300 ring-opacity-50' 
                        : ''
                    }`}
                    onClick={() => handleSectionClick(section.id, index)}
                    onKeyDown={(e) => handleKeyDown(e, section.id, index)}
                    onMouseEnter={() => setHoveredSection(section.id)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onFocus={() => setFocusedSection(section.id)}
                    onBlur={() => setFocusedSection(null)}
                    disabled={!isClickable}
                    aria-label={`${config.name}: ${state.replace('_', ' ')}`}
                    aria-describedby={`section-${index}-desc`}
                  >
                    {/* Section number badge */}
                    <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'
                    } border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {index + 1}
                    </div>

                    {/* Status icon or checkmark */}
                    {state === SECTION_STATES.COMPLETED ? (
                      <CheckIcon className="w-6 h-6 text-white animate-in fade-in duration-300" />
                    ) : state === SECTION_STATES.NEEDS_REVISION ? (
                      <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                    ) : (
                      <IconComponent className={`w-6 h-6 ${colors.icon}`} />
                    )}

                    {/* Validation score indicator */}
                    {completedSection?.validationScore && (
                      <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        completedSection.validationScore >= 80
                          ? 'bg-green-500 text-white'
                          : completedSection.validationScore >= 60
                          ? 'bg-yellow-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {completedSection.validationScore}
                      </div>
                    )}
                  </button>

                  {/* Section label */}
                  <div className="mt-3 text-center">
                    <div className={`text-sm font-medium ${colors.text}`} id={`section-${index}-desc`}>
                      {config.shortName || section.name}
                    </div>
                    {state === SECTION_STATES.IN_PROGRESS && (
                      <div className="text-xs text-blue-500 mt-1">Current</div>
                    )}
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Mobile vertical layout */}
      <div className="md:hidden space-y-4">
        {sections.map((section, index) => {
          const state = getSectionState(section.id, index);
          const colors = getSectionColors(state);
          const config = SECTION_CONFIG[section.id] || {};
          const IconComponent = config.icon || DocumentTextIcon;
          const isClickable = index <= currentSection || completedSections.some(cs => cs.id === section.id);
          const completedSection = completedSections.find(cs => cs.id === section.id);

          return (
            <div key={section.id} className="flex items-center gap-4 relative">
              {/* Connecting line (except for last item) */}
              {index < sections.length - 1 && (
                <div className={`absolute left-6 top-12 w-0.5 h-8 ${
                  index < completedSections.length 
                    ? 'bg-green-500' 
                    : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
              )}

              {/* Section circle */}
              <button
                className={`relative w-12 h-12 rounded-full border-2 transition-all duration-300 flex-shrink-0 ${
                  colors.bg
                } ${colors.border} ${
                  isClickable 
                    ? 'hover:scale-105 focus:scale-105 cursor-pointer' 
                    : 'cursor-not-allowed opacity-60'
                } ${
                  colors.pulse ? 'animate-pulse' : ''
                } ${
                  focusedSection === section.id 
                    ? 'ring-4 ring-blue-300 ring-opacity-50' 
                    : ''
                }`}
                onClick={() => handleSectionClick(section.id, index)}
                onKeyDown={(e) => handleKeyDown(e, section.id, index)}
                onFocus={() => setFocusedSection(section.id)}
                onBlur={() => setFocusedSection(null)}
                disabled={!isClickable}
                aria-label={`${config.name}: ${state.replace('_', ' ')}`}
              >
                {/* Section number badge */}
                <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'
                } border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  {index + 1}
                </div>

                {/* Status icon or checkmark */}
                {state === SECTION_STATES.COMPLETED ? (
                  <CheckIcon className="w-5 h-5 text-white" />
                ) : state === SECTION_STATES.NEEDS_REVISION ? (
                  <ExclamationTriangleIcon className="w-5 h-5 text-white" />
                ) : (
                  <IconComponent className={`w-5 h-5 ${colors.icon}`} />
                )}
              </button>

              {/* Section info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-medium ${colors.text}`}>
                      {config.name || section.name}
                    </h3>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {config.description}
                    </p>
                    {state === SECTION_STATES.IN_PROGRESS && (
                      <div className="text-xs text-blue-500 mt-1">Currently active</div>
                    )}
                  </div>

                  {/* Validation score */}
                  {completedSection?.validationScore && (
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      completedSection.validationScore >= 80
                        ? 'bg-green-100 text-green-800'
                        : completedSection.validationScore >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {completedSection.validationScore}/100
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

ProgressTracker.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired
    })
  ).isRequired,
  currentSection: PropTypes.number.isRequired,
  completedSections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      validationScore: PropTypes.number,
      needsRevision: PropTypes.bool
    })
  ),
  onSectionClick: PropTypes.func,
  className: PropTypes.string
};

ProgressTracker.defaultProps = {
  completedSections: [],
  onSectionClick: null,
  className: ''
};

export default ProgressTracker;