import React from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export const CompetencyRadarChart = ({ labels = [], currentScores = [], requiredScores = [], employeeName = "Employee" }) => {
  const data = {
    labels: labels.length > 0 ? labels : ['Leadership', 'Communication', 'Decision Making', 'Team Mgmt', 'Strategic', 'Problem Solving', 'Adaptability', 'Technical'],
    datasets: [
      {
        label: `${employeeName} Current`,
        data: currentScores.length > 0 ? currentScores : [78, 85, 72, 80, 70, 82, 85, 90],
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
      },
      {
        label: 'Target Requirement',
        data: requiredScores.length > 0 ? requiredScores : [90, 90, 85, 85, 85, 80, 80, 75],
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.8)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Inter', size: 11 } }
      }
    },
    scales: {
      r: {
        angleLines: { color: 'rgba(226, 232, 240, 0.8)' },
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        suggestedMin: 40,
        suggestedMax: 100,
        ticks: { stepSize: 20 }
      }
    }
  };

  return (
    <div className="w-full h-72">
      <Radar data={data} options={options} />
    </div>
  );
};

export default CompetencyRadarChart;
