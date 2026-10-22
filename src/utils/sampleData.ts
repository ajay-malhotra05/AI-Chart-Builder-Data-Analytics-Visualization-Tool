export const SAMPLE_DATASETS = [
  {
    id: 'ecommerce_sales',
    name: 'E-Commerce Orders & Profits',
    format: 'csv' as const,
    description: '20 transaction orders across Technology, Furniture, and Office Supplies with Sales and Profit.',
    data: `order_id,date,customer_segment,category,sub_category,region,sales,profit,quantity,discount
ORD-1001,2024-01-15,Corporate,Technology,Phones,North,1250.00,320.50,3,0.05
ORD-1002,2024-01-18,Consumer,Furniture,Chairs,South,420.80,65.20,2,0.10
ORD-1003,2024-01-20,Home Office,Office Supplies,Binders,West,85.20,28.40,5,0.00
ORD-1004,2024-01-25,Consumer,Technology,Laptops,East,2100.50,540.00,2,0.00
ORD-1005,2024-02-02,Corporate,Furniture,Tables,North,890.00,-45.00,1,0.15
ORD-1006,2024-02-05,Consumer,Office Supplies,Paper,South,64.30,22.10,6,0.00
ORD-1007,2024-02-12,Corporate,Technology,Accessories,East,310.00,95.00,4,0.05
ORD-1008,2024-02-18,Home Office,Furniture,Bookcases,West,620.40,110.20,2,0.10
ORD-1009,2024-03-01,Consumer,Technology,Phones,South,1580.00,410.00,4,0.00
ORD-1010,2024-03-05,Corporate,Office Supplies,Storage,North,340.50,78.20,3,0.05
ORD-1011,2024-03-10,Consumer,Furniture,Chairs,East,510.00,82.00,3,0.10
ORD-1012,2024-03-15,Home Office,Technology,Laptops,West,1850.00,480.00,1,0.00
ORD-1013,2024-03-22,Corporate,Furniture,Furnishings,South,190.20,45.50,4,0.05
ORD-1014,2024-03-28,Consumer,Office Supplies,Appliances,East,460.00,130.00,2,0.00
ORD-1015,2024-04-02,Home Office,Technology,Phones,North,950.00,240.00,2,0.05
ORD-1016,2024-04-09,Corporate,Office Supplies,Art,West,45.60,14.80,5,0.00
ORD-1017,2024-04-14,Consumer,Furniture,Tables,South,1120.00,140.00,2,0.10
ORD-1018,2024-04-20,Corporate,Technology,Accessories,North,280.00,85.00,3,0.00
ORD-1019,2024-04-25,Home Office,Furniture,Chairs,East,690.00,115.00,3,0.05
ORD-1020,2024-05-02,Consumer,Technology,Laptops,West,3400.00,890.00,3,0.00`,
  },
  {
    id: 'tech_salaries',
    name: 'Tech Compensation & Roles',
    format: 'json' as const,
    description: 'Engineering, Data, and AI role compensation by experience level and country.',
    data: JSON.stringify([
      { id: 1, role: 'Senior Data Architect', department: 'Data Platform', experience_level: 'Senior', years_experience: 9, salary_usd: 185000, remote_ratio: 100, country: 'United States' },
      { id: 2, role: 'MLOps Engineer', department: 'AI Engineering', experience_level: 'Mid', years_experience: 4, salary_usd: 142000, remote_ratio: 50, country: 'Germany' },
      { id: 3, role: 'Full Stack Engineer', department: 'Product', experience_level: 'Senior', years_experience: 7, salary_usd: 160000, remote_ratio: 100, country: 'United States' },
      { id: 4, role: 'Data Analyst', department: 'Business Intelligence', experience_level: 'Junior', years_experience: 2, salary_usd: 85000, remote_ratio: 0, country: 'United Kingdom' },
      { id: 5, role: 'Principal AI Researcher', department: 'AI Engineering', experience_level: 'Executive', years_experience: 12, salary_usd: 245000, remote_ratio: 100, country: 'United States' },
      { id: 6, role: 'Backend Engineer', department: 'Core Infrastructure', experience_level: 'Mid', years_experience: 5, salary_usd: 135000, remote_ratio: 50, country: 'Canada' },
      { id: 7, role: 'Frontend Architect', department: 'Product', experience_level: 'Senior', years_experience: 8, salary_usd: 172000, remote_ratio: 100, country: 'United States' },
      { id: 8, role: 'DevOps Engineer', department: 'Core Infrastructure', experience_level: 'Senior', years_experience: 6, salary_usd: 155000, remote_ratio: 100, country: 'Australia' },
      { id: 9, role: 'Data Engineer', department: 'Data Platform', experience_level: 'Mid', years_experience: 4, salary_usd: 128000, remote_ratio: 50, country: 'Netherlands' },
      { id: 10, role: 'Product Designer', department: 'Product', experience_level: 'Mid', years_experience: 5, salary_usd: 115000, remote_ratio: 0, country: 'United States' },
      { id: 11, role: 'Data Scientist', department: 'AI Engineering', experience_level: 'Senior', years_experience: 6, salary_usd: 168000, remote_ratio: 100, country: 'United States' },
      { id: 12, role: 'Security Engineer', department: 'Core Infrastructure', experience_level: 'Senior', years_experience: 8, salary_usd: 175000, remote_ratio: 50, country: 'United States' }
    ], null, 2),
  },
  {
    id: 'saas_growth',
    name: 'SaaS Customer Cohorts & MRR',
    format: 'csv' as const,
    description: 'B2B SaaS plan metrics, monthly recurring revenue, churn rate, and active users.',
    data: `plan_tier,billing_cycle,mrr_usd,churn_rate,active_teams,customer_satisfaction
Enterprise,Annual,48500,0.012,142,4.8
Enterprise,Quarterly,22300,0.021,68,4.6
Growth,Annual,31200,0.028,215,4.5
Growth,Monthly,19800,0.045,180,4.2
Starter,Monthly,8400,0.062,390,3.9
Starter,Annual,12600,0.038,410,4.3
Team Pro,Monthly,14900,0.041,195,4.4
Team Pro,Annual,21400,0.024,240,4.6`,
  }
];
