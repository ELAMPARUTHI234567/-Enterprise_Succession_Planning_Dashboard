import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const CompetencyBarChart = ({ labels = [], currentScores = [], requiredScores = [] }) => {
  const data = {
    labels: labels.length > 0 ? labels : ['Leadership', 'Communication', 'Decision Making', 'Team Mgmt', 'Strategic', 'Problem Solving', 'Adaptability', 'Technical'],
    datasets: [
      {
        label: 'Current Score',
        data: currentScores.length > 0 ? currentScores : [78, 85, 72, 80, 70, 82, 85, 90],
        backgroundColor: 'rgba(99, 102, 241, 0.85)', // Indigo
        borderRadius: 6,
      },
      {
        label: 'Required Target',
        data: requiredScores.length > 0 ? requiredScores : [90, 90, 85, 85, 85, 80, 80, 75],
        backgroundColor: 'rgba(203, 213, 225, 0.7)', // Slate
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Inter', size: 12, weight: '500' } }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.raw}%`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, callback: (v) => `${v}%` },
        grid: { color: 'rgba(226, 232, 240, 0.6)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  return (
    <div className="w-full h-72">
      <Bar data={data} options={options} />
    </div>
  );
};

export default CompetencyBarChart;
