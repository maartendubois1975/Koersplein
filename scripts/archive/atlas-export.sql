-- Run read-only against the frozen Atlas PostgreSQL database.
-- Export with psql \copy (...) TO STDOUT; one dataset per NDJSON/CSV staging file.
-- Never point Koersplein production runtime at this database.
SELECT id,figi,ticker,name,mic,country,currency,canonical_company_key,isin FROM global_securities;
SELECT security_id,listing_id,price_date,open,high,low,close,volume,chosen_provider,quality_state,identity_grade,decision_eligible FROM atlas_price_v2_canonical;
SELECT security_id,as_of_date,horizon_code,horizon_months,start_price_date,start_price,target_date,end_price_date,end_price,realised_return_pct,realised_total_return_pct,label_status,label_source,terminal_proxy FROM historical_return_labels;
SELECT security_id,as_of_date,feature_version,feature_json,coverage,max_input_date,frozen_at,snapshot_hash FROM historical_feature_snapshots;
SELECT forecast_id,candidate_id,forecast_at,evidence_cutoff,horizon_months,model_spec_hash,predicted_return_pct,start_price,payload FROM prediction_lab100_historical_forecasts;
SELECT forecast_id,maturity_date,realized_date,realized_return_pct,absolute_error_pct,direction_correct,payload FROM prediction_lab100_outcomes;
SELECT security_id,action_date,action_type,value,source,source_symbol,retrieved_at FROM historical_corporate_actions;
