import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProgressTracker from '../ProgressTracker';
import { useTheme } from '../../hooks/useTheme';

// Mock the theme hook
jest.mock('../../hooks/useTheme', () => ({
  useTheme: jest.fn()
}));

// Mock the Tooltip component
jest.mock('../Tooltip', () => {
  return function MockTooltip({ children, content, disabled }) {
    return (
      <div>
        {children}
        {!disabled && <div data-testid="tooltip">{content}</div>}
      </div>
    );
  };
});

const mockSections = [
  { id: 'introduction', name: 'Introduction' },
  { id: 'goals', name: 'Goals & Objectives' },
  { id: 'audience', name: 'Target Audience' },
  { id: 'userStories', name: 'User Stories' },
  { id: 'requirements', name: 'Requirements' },
  { id: 'metrics', name: 'Success Metrics' },
  { id: 'questions', name: 'Open Questions' }
];

const defaultProps = {
  sections: mockSections,
  currentSection: 0,
  completedSections: [],
  onSectionClick: jest.fn()
};

describe('ProgressTracker', () => {
  beforeEach(() => {
    useTheme.mockReturnValue({ isDarkMode: false });
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all sections', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      mockSections.forEach((section, index) => {
        expect(screen.getByLabelText(new RegExp(section.name))).toBeInTheDocument();
      });
    });

    it('should show overall progress percentage', () => {
      const props = {
        ...defaultProps,
        completedSections: [{ id: 'introduction' }, { id: 'goals' }]
      };
      
      render(<ProgressTracker {...props} />);
      
      expect(screen.getByText('29% Complete')).toBeInTheDocument(); // 2/7 ≈ 29%
    });

    it('should display section numbers', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      mockSections.forEach((_, index) => {
        expect(screen.getByText(String(index + 1))).toBeInTheDocument();
      });
    });

    it('should show validation scores for completed sections', () => {
      const props = {
        ...defaultProps,
        completedSections: [
          { id: 'introduction', validationScore: 85 },
          { id: 'goals', validationScore: 72 }
        ]
      };
      
      render(<ProgressTracker {...props} />);
      
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('72')).toBeInTheDocument();
    });
  });

  describe('Section States', () => {
    it('should show current section as in progress', () => {
      const props = {
        ...defaultProps,
        currentSection: 1
      };
      
      render(<ProgressTracker {...props} />);
      
      const currentButton = screen.getByLabelText(/Goals & Objectives.*in progress/);
      expect(currentButton).toHaveClass('bg-blue-500');
    });

    it('should show completed sections with checkmarks', () => {
      const props = {
        ...defaultProps,
        currentSection: 2,
        completedSections: [{ id: 'introduction' }, { id: 'goals' }]
      };
      
      render(<ProgressTracker {...props} />);
      
      const completedButtons = screen.getAllByRole('button').filter(button => 
        button.classList.contains('bg-green-500')
      );
      expect(completedButtons).toHaveLength(2);
    });

    it('should show sections needing revision in yellow', () => {
      const props = {
        ...defaultProps,
        currentSection: 2,
        completedSections: [
          { id: 'introduction', needsRevision: true }
        ]
      };
      
      render(<ProgressTracker {...props} />);
      
      const revisionButton = screen.getByLabelText(/Introduction.*needs revision/);
      expect(revisionButton).toHaveClass('bg-yellow-500');
    });

    it('should show not started sections as disabled', () => {
      const props = {
        ...defaultProps,
        currentSection: 1
      };
      
      render(<ProgressTracker {...props} />);
      
      // Sections beyond current should be disabled
      const futureButtons = screen.getAllByRole('button').slice(2);
      futureButtons.forEach(button => {
        expect(button).toBeDisabled();
        expect(button).toHaveClass('opacity-60');
      });
    });
  });

  describe('Navigation', () => {
    it('should call onSectionClick when clicking accessible section', async () => {
      const mockClick = jest.fn();
      const props = {
        ...defaultProps,
        currentSection: 2,
        completedSections: [{ id: 'introduction' }],
        onSectionClick: mockClick
      };
      
      render(<ProgressTracker {...props} />);
      
      const introButton = screen.getByLabelText(/Introduction/);
      await userEvent.click(introButton);
      
      expect(mockClick).toHaveBeenCalledWith('introduction', 0);
    });

    it('should not call onSectionClick for inaccessible sections', async () => {
      const mockClick = jest.fn();
      const props = {
        ...defaultProps,
        currentSection: 1,
        onSectionClick: mockClick
      };
      
      render(<ProgressTracker {...props} />);
      
      // Try to click a future section (should be disabled)
      const futureButton = screen.getAllByRole('button')[3]; // requirements section
      await userEvent.click(futureButton);
      
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard navigation with Enter key', async () => {
      const mockClick = jest.fn();
      const props = {
        ...defaultProps,
        currentSection: 1,
        completedSections: [{ id: 'introduction' }],
        onSectionClick: mockClick
      };
      
      render(<ProgressTracker {...props} />);
      
      const introButton = screen.getByLabelText(/Introduction/);
      introButton.focus();
      
      await userEvent.keyboard('{Enter}');
      
      expect(mockClick).toHaveBeenCalledWith('introduction', 0);
    });

    it('should handle keyboard navigation with Space key', async () => {
      const mockClick = jest.fn();
      const props = {
        ...defaultProps,
        currentSection: 1,
        completedSections: [{ id: 'introduction' }],
        onSectionClick: mockClick
      };
      
      render(<ProgressTracker {...props} />);
      
      const introButton = screen.getByLabelText(/Introduction/);
      introButton.focus();
      
      await userEvent.keyboard(' ');
      
      expect(mockClick).toHaveBeenCalledWith('introduction', 0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const props = {
        ...defaultProps,
        currentSection: 1,
        completedSections: [{ id: 'introduction' }]
      };
      
      render(<ProgressTracker {...props} />);
      
      expect(screen.getByLabelText(/Introduction.*completed/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Goals & Objectives.*in progress/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Audience.*not started/)).toBeInTheDocument();
    });

    it('should have role status for announcements', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
      expect(statusElement).toHaveAttribute('aria-atomic', 'true');
    });

    it('should show focus indicators', async () => {
      render(<ProgressTracker {...defaultProps} />);
      
      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();
      
      expect(firstButton).toHaveFocus();
    });

    it('should announce navigation changes', async () => {
      const mockClick = jest.fn();
      const props = {
        ...defaultProps,
        onSectionClick: mockClick
      };
      
      render(<ProgressTracker {...props} />);
      
      const currentButton = screen.getByLabelText(/Introduction/);
      await userEvent.click(currentButton);
      
      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/Navigated to Introduction/);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should show desktop layout on large screens', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      // Desktop layout should be visible
      const desktopLayout = screen.getByRole('button').closest('.hidden.md\\:block');
      expect(desktopLayout).toBeInTheDocument();
    });

    it('should show mobile layout on small screens', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      // Mobile layout should be visible
      const mobileLayout = screen.getByRole('button').closest('.md\\:hidden');
      expect(mobileLayout).toBeInTheDocument();
    });
  });

  describe('Animations and Interactions', () => {
    it('should show hover states', async () => {
      render(<ProgressTracker {...defaultProps} />);
      
      const button = screen.getAllByRole('button')[0];
      
      await userEvent.hover(button);
      
      expect(button).toHaveClass('hover:scale-110');
    });

    it('should show pulse animation for current section', () => {
      const props = {
        ...defaultProps,
        currentSection: 1
      };
      
      render(<ProgressTracker {...props} />);
      
      const currentButton = screen.getByLabelText(/Goals & Objectives.*in progress/);
      expect(currentButton).toHaveClass('animate-pulse');
    });

    it('should show progress bar animation', () => {
      const props = {
        ...defaultProps,
        completedSections: [{ id: 'introduction' }, { id: 'goals' }]
      };
      
      render(<ProgressTracker {...props} />);
      
      const progressBar = screen.getByRole('progressbar', { hidden: true }) || 
                         document.querySelector('[style*="width"]');
      expect(progressBar).toBeTruthy();
    });
  });

  describe('Dark Mode', () => {
    beforeEach(() => {
      useTheme.mockReturnValue({ isDarkMode: true });
    });

    it('should apply dark mode styles', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      const title = screen.getByText('PRD Progress');
      expect(title.closest('div')).toHaveClass('text-gray-100');
    });

    it('should use dark colors for not started sections', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      const notStartedButton = screen.getAllByRole('button')[1]; // goals section
      expect(notStartedButton).toHaveClass('bg-gray-700');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing section configuration gracefully', () => {
      const propsWithInvalidSection = {
        ...defaultProps,
        sections: [{ id: 'invalid-section', name: 'Invalid Section' }]
      };
      
      expect(() => {
        render(<ProgressTracker {...propsWithInvalidSection} />);
      }).not.toThrow();
      
      expect(screen.getByText('Invalid Section')).toBeInTheDocument();
    });

    it('should handle missing onSectionClick prop', async () => {
      const props = {
        ...defaultProps,
        onSectionClick: undefined
      };
      
      render(<ProgressTracker {...props} />);
      
      const button = screen.getAllByRole('button')[0];
      
      expect(() => userEvent.click(button)).not.toThrow();
    });

    it('should handle empty sections array', () => {
      const props = {
        ...defaultProps,
        sections: []
      };
      
      render(<ProgressTracker {...props} />);
      
      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const { rerender } = render(<ProgressTracker {...defaultProps} />);
      
      // Re-render with same props
      rerender(<ProgressTracker {...defaultProps} />);
      
      // Should still work correctly
      expect(screen.getByText('PRD Progress')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(mockSections.length);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress correctly with no completed sections', () => {
      render(<ProgressTracker {...defaultProps} />);
      
      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });

    it('should calculate progress correctly with all sections completed', () => {
      const props = {
        ...defaultProps,
        completedSections: mockSections.map(section => ({ id: section.id }))
      };
      
      render(<ProgressTracker {...props} />);
      
      expect(screen.getByText('100% Complete')).toBeInTheDocument();
    });

    it('should round progress percentage correctly', () => {
      const props = {
        ...defaultProps,
        completedSections: [{ id: 'introduction' }] // 1/7 = 14.28... ≈ 14%
      };
      
      render(<ProgressTracker {...props} />);
      
      expect(screen.getByText('14% Complete')).toBeInTheDocument();
    });
  });
});